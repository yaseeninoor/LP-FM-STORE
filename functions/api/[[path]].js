const H={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:H});
const list=v=>(v||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
const str=v=>v==null?"":String(v).trim();
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const pick=(o,...ks)=>{for(const k of ks)if(o[k]!==undefined&&o[k]!==null&&o[k]!=="")return o[k];return""};
function b64(s){s=s.replace(/-/g,"+").replace(/_/g,"/");return Uint8Array.from(atob(s+"=".repeat((4-s.length%4)%4)),c=>c.charCodeAt(0))}
async function identity(req,env){
 const t=req.headers.get("Cf-Access-Jwt-Assertion"); if(!t)throw Error("Sign in through Cloudflare Access first.");
 const p=t.split(".");if(p.length!==3)throw Error("Invalid Access token.");
 const h=JSON.parse(new TextDecoder().decode(b64(p[0]))),c=JSON.parse(new TextDecoder().decode(b64(p[1])));
 const team=(env.ACCESS_TEAM_DOMAIN||"").replace(/^https?:\/\//,"").replace(/\/$/,"");
 if(!team||!env.ACCESS_AUD)throw Error("Cloudflare Access settings are not configured.");
 if(c.iss!==`https://${team}`||!(Array.isArray(c.aud)?c.aud:[c.aud]).includes(env.ACCESS_AUD))throw Error("Access token audience or issuer mismatch.");
 const now=Math.floor(Date.now()/1000);if(c.exp<now||(c.nbf&&c.nbf>now))throw Error("Access token expired.");
 const cr=await fetch(`https://${team}/cdn-cgi/access/certs`);if(!cr.ok)throw Error("Could not validate Access certificate.");
 const cert=await cr.json(),j=(cert.keys||[]).find(x=>x.kid===h.kid);if(!j)throw Error("Access signing key not found.");
 const key=await crypto.subtle.importKey("jwk",j,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
 if(!await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,b64(p[2]),new TextEncoder().encode(p[0]+"."+p[1])))throw Error("Access token signature invalid.");
 const email=str(c.email).toLowerCase();const role=list(env.ADMIN_EMAILS).includes(email)?"admin":list(env.STORE_STAFF_EMAILS).includes(email)?"store":list(env.DEPARTMENT_EMAILS).includes(email)?"department":null;
 if(!role)throw Error("Your email is not authorised. Contact LP FM Store Admin.");
 return {email,role};
}
const need=(u,roles)=>{if(!roles.includes(u.role))throw Error("Permission denied for this role.")};
const date=v=>{if(!v)return new Date().toISOString().slice(0,10);let s=String(v);if(/^\d{8}$/.test(s))return s.slice(0,4)+"-"+s.slice(4,6)+"-"+s.slice(6,8);return s.slice(0,10)};
async function audit(db,u,action,type,ref,detail){await db.prepare("INSERT INTO audit_log(user_email,action,entity_type,entity_ref,details) VALUES(?,?,?,?,?)").bind(u.email,action,type,ref||"",JSON.stringify(detail||{})).run()}
async function importRows(db,type,rows,snapshotDate){
 const tables={stock:"materials",reservations:"sap_reservations",pr:"sap_pr",po:"sap_po",gate:"sap_gate_entries",grn:"sap_grn"};
 if(!tables[type])throw Error("Unknown SAP report type.");
 await db.prepare("DELETE FROM "+tables[type]).run();
 const map={
 stock:r=>[str(pick(r,"Material")),str(pick(r,"Material Description")),str(pick(r,"Base Unit of Measure")),num(pick(r,"Unrestricted")),date(snapshotDate)],
 reservations:r=>[str(pick(r,"Reservation")),str(pick(r,"Item No.Stock Transfer Reserv.")),date(pick(r,"Requirement Date")),str(pick(r,"Movement Type")),str(pick(r,"Material")),str(pick(r,"Material Description")),num(pick(r,"Requirement Quantity")),num(pick(r,"Difference Quantity")),str(pick(r,"Base Unit of Measure")),str(pick(r,"Cost Center")),str(pick(r,"User name")),str(pick(r,"Reserv. status")),str(pick(r,"Final Issue")),JSON.stringify(r)],
 pr:r=>[str(pick(r,"Purchase Requisition")),str(pick(r,"Item of Requisition")),str(pick(r,"Purchase Order")),str(pick(r,"Processing status")),str(pick(r,"Material")),str(pick(r,"Short Text")),num(pick(r,"Quantity Requested")),str(pick(r,"Unit of Measure")),date(pick(r,"Delivery Date")),date(pick(r,"Requisition Date")),str(pick(r,"Storage Location")),str(pick(r,"Requisitioner")),JSON.stringify(r)],
 po:r=>[str(pick(r,"Purchasing Document")),str(pick(r,"Item")),str(pick(r,"Material")),str(pick(r,"Short Text")),str(pick(r,"Name of Vendor")),num(pick(r,"Order Quantity")),num(pick(r,"Still to be delivered (qty)")),num(pick(r,"Net price")),str(pick(r,"Currency")),date(pick(r,"Document Date")),JSON.stringify(r)],
 gate:r=>[str(pick(r,"Gate Entry Number")),str(pick(r,"PO Number")),str(pick(r,"Material No")),str(pick(r,"Material Info")),num(pick(r,"Quantity")),str(pick(r,"UoM")),str(pick(r,"Party Name")),date(pick(r,"Created On")),str(pick(r,"Remarks")),JSON.stringify(r)],
 grn:r=>[date(pick(r,"Posting Date")),str(pick(r,"Purchase Order")),str(pick(r,"Material")),str(pick(r,"Material Description")),str(pick(r,"Movement Type")),str(pick(r,"Movement Type Text")),str(pick(r,"Material Document")),num(pick(r,"Qty in Un. of Entry")),str(pick(r,"Base Unit of Measure")),str(pick(r,"Storage Location")),str(pick(r,"Reservation")),JSON.stringify(r)]
 };
 const sql={
 stock:"INSERT INTO materials(material_code,description,uom,sap_unrestricted,stock_date) VALUES(?,?,?,?,?)",
 reservations:"INSERT INTO sap_reservations(reservation_no,item_no,requirement_date,movement_type,material_code,description,requirement_qty,difference_qty,uom,cost_center,requested_by,reservation_status,final_issue,raw_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
 pr:"INSERT INTO sap_pr(pr_no,item_no,po_no,processing_status,material_code,description,requested_qty,uom,delivery_date,pr_date,storage_location,requisitioner,raw_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
 po:"INSERT INTO sap_po(po_no,item_no,material_code,description,vendor,order_qty,remaining_qty,unit_price,currency,document_date,raw_json) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
 gate:"INSERT INTO sap_gate_entries(gate_no,po_no,material_code,description,qty,uom,vendor,entry_date,remarks,raw_json) VALUES(?,?,?,?,?,?,?,?,?,?)",
 grn:"INSERT INTO sap_grn(posting_date,po_no,material_code,description,movement_type,movement_text,material_document,qty,uom,storage_location,reservation_no,raw_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)"
 };
 const statements=rows.filter(r=>type!=="pr"||pick(r,"Purchase Requisition")).filter(r=>type!=="stock"||pick(r,"Material")).map(r=>db.prepare(sql[type]).bind(...map[type](r)));
 for(let i=0;i<statements.length;i+=80)await db.batch(statements.slice(i,i+80));
 return statements.length;
}
export async function onRequest({request,env}){
 try{
  const u=await identity(request,env),url=new URL(request.url),path=url.pathname.replace(/^\/api\/?/,""),db=env.DB;
  if(request.method==="GET"&&path==="me")return reply({user:u});
  if(request.method==="GET"&&path==="dashboard"){
   const qs=await Promise.all(["SELECT COUNT(*) n FROM materials","SELECT COUNT(*) n FROM sap_reservations","SELECT COUNT(*) n FROM sap_pr","SELECT COUNT(*) n FROM sap_po","SELECT COUNT(*) n FROM sap_gate_entries","SELECT COUNT(*) n FROM sap_grn","SELECT COUNT(*) n FROM transactions","SELECT COUNT(*) n FROM cash_purchases","SELECT COUNT(*) n FROM department_requests WHERE status='Pending'"].map(q=>db.prepare(q).first()));
   return reply({user:u,materials:qs[0].n,reservations:qs[1].n,prs:qs[2].n,pos:qs[3].n,gates:qs[4].n,grns:qs[5].n,movements:qs[6].n,cash:qs[7].n,pendingRequests:qs[8].n});
  }
  if(request.method==="GET"&&path==="materials"){
   const q="%"+str(url.searchParams.get("q"))+"%";
   const r=await db.prepare("SELECT m.*,COALESCE((SELECT SUM(qty_in-qty_out) FROM transactions t WHERE t.material_code=m.material_code AND t.transaction_date>m.stock_date),0) movement,(m.sap_unrestricted+COALESCE((SELECT SUM(qty_in-qty_out) FROM transactions t WHERE t.material_code=m.material_code AND t.transaction_date>m.stock_date),0)) balance FROM materials m WHERE m.material_code LIKE ? OR m.description LIKE ? ORDER BY m.description LIMIT 500").bind(q,q).all();
   return reply({rows:r.results});
  }
  if(request.method==="GET"&&path==="ledger"){const r=await db.prepare("SELECT * FROM transactions ORDER BY transaction_date DESC,id DESC LIMIT 500").all();return reply({rows:r.results})}
  if(request.method==="GET"&&path==="requests"){const r=await db.prepare("SELECT * FROM department_requests ORDER BY id DESC LIMIT 300").all();return reply({rows:r.results})}
  if(request.method==="POST"&&path.startsWith("import/")){
   need(u,["admin"]);const type=path.split("/")[1],d=await request.json();if(!Array.isArray(d.rows)||d.rows.length>10000) return reply({error:"Invalid import rows."},400);
   const count=await importRows(db,type,d.rows,d.snapshotDate||"2026-11-17");
   await db.prepare("INSERT INTO sap_imports(report_type,imported_by,row_count) VALUES(?,?,?)").bind(type,u.email,count).run();
   await audit(db,u,"IMPORT",type,"",{rows:count});return reply({ok:true,rows:count});
  }
  if(request.method==="POST"&&path==="cash-purchases"){
   need(u,["admin","store"]);const d=await request.json();if(!d.purchase_ref||!d.vendor||!d.material_code||num(d.qty)<=0)return reply({error:"Purchase reference, vendor, material and positive quantity required."},400);
   await db.prepare("INSERT INTO cash_purchases(purchase_ref,purchase_date,vendor,invoice_no,material_code,description,uom,qty,unit_price,department,urgency_reason,approval_status,approved_by,created_by,remarks) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(str(d.purchase_ref),date(d.purchase_date),str(d.vendor),str(d.invoice_no),str(d.material_code),str(d.description),str(d.uom),num(d.qty),num(d.unit_price),str(d.department),str(d.urgency_reason),str(d.approval_status||"Pending"),str(d.approved_by),u.email,str(d.remarks)).run();
   await audit(db,u,"CREATE","cash_purchase",d.purchase_ref,d);return reply({ok:true});
  }
  if(request.method==="POST"&&path==="transactions"){
   need(u,["admin","store"]);const d=await request.json(),qty=num(d.quantity),type=str(d.transaction_type);
   if(!d.transaction_ref||!d.material_code||qty<=0)return reply({error:"Transaction ref, material and positive quantity required."},400);
   if(!["SAP Receipt","Cash Purchase Receipt","Department Issue","Department Return","Approved Adjustment"].includes(type))return reply({error:"Invalid movement type."},400);
   const approval=str(d.approval_status||"Pending"),qc=str(d.qc_status||"Pending");
   if(type==="Cash Purchase Receipt"&&approval!=="Approved")return reply({error:"Cash purchase approval is required before stock receipt."},400);
   if(type==="SAP Receipt"&&!["Released","Not Required"].includes(qc))return reply({error:"Required QC release must be confirmed before counting as available."},400);
   const incoming=["SAP Receipt","Cash Purchase Receipt","Department Return"].includes(type)?qty:0;
   const outgoing=type==="Department Issue"||(type==="Approved Adjustment"&&d.direction==="OUT")?qty:0;
   await db.prepare("INSERT INTO transactions(transaction_ref,transaction_date,transaction_type,material_code,description,uom,qty_in,qty_out,department,vendor,pr_no,po_no,gate_no,grn_no,approval_ref,approval_status,qc_status,invoice_no,created_by,remarks) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(str(d.transaction_ref),date(d.transaction_date),type,str(d.material_code),str(d.description),str(d.uom),incoming,outgoing,str(d.department),str(d.vendor),str(d.pr_no),str(d.po_no),str(d.gate_no),str(d.grn_no),str(d.approval_ref),approval,qc,str(d.invoice_no),u.email,str(d.remarks)).run();
   await audit(db,u,"CREATE","transaction",d.transaction_ref,d);return reply({ok:true});
  }
  if(request.method==="POST"&&path==="requests"){
   need(u,["admin","store","department"]);const d=await request.json();if(!d.request_ref||!d.department||!d.material_code||num(d.requested_qty)<=0)return reply({error:"Request ref, department, material and positive quantity required."},400);
   await db.prepare("INSERT INTO department_requests(request_ref,request_date,department,material_code,description,uom,requested_qty,reservation_no,requested_by,status,remarks) VALUES(?,?,?,?,?,?,?,?,?,'Pending',?)").bind(str(d.request_ref),date(d.request_date),str(d.department),str(d.material_code),str(d.description),str(d.uom),num(d.requested_qty),str(d.reservation_no),u.email,str(d.remarks)).run();
   await audit(db,u,"CREATE","department_request",d.request_ref,d);return reply({ok:true});
  }
  return reply({error:"Route not found."},404);
 }catch(e){const m=e.message||"Server error";return reply({error:m},/Permission|authorised/i.test(m)?403:/Access|token|issuer|audience|certificate|signing key/i.test(m)?401:400)}
}