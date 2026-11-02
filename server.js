const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const PORT = Number(process.env.PORT || 3000);
const root = __dirname;
const publicDir = path.join(root, 'public');
const dbPath = path.join(root, 'data', 'db.json');
const seed = require('./data/seed.json');
if (!fs.existsSync(dbPath)) {
 fs.writeFileSync(dbPath, JSON.stringify(seed, null, 2));
} else {
 // One-time demo catalogue expansion. Preserve user-created properties, edits and enquiries.
 const existing=JSON.parse(fs.readFileSync(dbPath,'utf8'));
 if ((existing.seedVersion||1)<2) {
  const ids=new Set((existing.properties||[]).map(p=>p.id));
  for (const p of seed.properties) if (!ids.has(p.id)) existing.properties.push(p);
  existing.seedVersion=2;
  fs.writeFileSync(dbPath,JSON.stringify(existing,null,2));
 }
}
function readDb(){ return JSON.parse(fs.readFileSync(dbPath,'utf8')); }
function writeDb(db){ const temp=dbPath+'.tmp'; fs.writeFileSync(temp,JSON.stringify(db,null,2)); fs.renameSync(temp,dbPath); }
function send(res,code,data){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function error(res,code,message){send(res,code,{error:message});}
function parseBody(req){return new Promise((resolve,reject)=>{let raw='';req.on('data',c=>{raw+=c;if(raw.length>200000){reject(new Error('Request too large'));req.destroy();}});req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{});}catch{reject(new Error('Invalid JSON'));}});req.on('error',reject);});}
function validProperty(x){
 const required=['title','city','locality','type','purpose','price','bedrooms','bathrooms','area','parking'];
 for(const k of required) if(x[k]===undefined||x[k]===null||x[k]==='')return `${k} is required`;
 if(!['Sale','Rent'].includes(x.purpose))return 'Purpose must be Sale or Rent';
 if(!['Apartment','Villa','Independent House','Studio','Commercial','Plot'].includes(x.type))return 'Invalid property type';
 if(typeof x.title!=='string'||x.title.trim().length<3||x.title.length>100)return 'Enter a valid property title';
 if(typeof x.city!=='string'||!x.city.trim()||x.city.length>70||typeof x.locality!=='string'||!x.locality.trim()||x.locality.length>90)return 'Enter a valid city and locality';
 if(!Number.isFinite(+x.price)||+x.price<=0||!Number.isFinite(+x.area)||+x.area<=0)return 'Price and area must be positive';
 if(![x.bedrooms,x.bathrooms].every(n=>Number.isInteger(+n)&&+n>=0&&+n<=20))return 'Bedrooms and bathrooms must be between 0 and 20';
 if(typeof x.parking!=='boolean')return 'Parking must be a boolean';
 if(x.images && (!Array.isArray(x.images)||x.images.length>12||x.images.some(z=>typeof z!=='string'||!/^https:\/\//.test(z))))return 'Images must be an array of up to 12 HTTPS URLs';
 if(x.image && (typeof x.image!=='string'||!/^https:\/\//.test(x.image)))return 'Image must be an HTTPS URL';
 return null;
}
function cleanProperty(x, old={}) {return {...old,title:x.title.trim(),city:x.city.trim(),locality:x.locality.trim(),type:x.type,purpose:x.purpose,price:Number(x.price),bedrooms:Number(x.bedrooms),bathrooms:Number(x.bathrooms),area:Number(x.area),parking:x.parking,description:String(x.description||'').slice(0,700),image:String(x.image||x.images?.[0]||'').slice(0,500),images:(Array.isArray(x.images)?x.images:[x.image].filter(Boolean)).slice(0,12),featured:Boolean(x.featured),updatedAt:new Date().toISOString()};}
function matches(p,q){return (!q.purpose||p.purpose===q.purpose)&&(!q.city||p.city.toLowerCase()===q.city.toLowerCase())&&(!q.type||p.type===q.type)&&(!q.maxPrice||p.price<=Number(q.maxPrice))&&(!q.minPrice||p.price>=Number(q.minPrice))&&(p.bedrooms>=Number(q.bedrooms||0))&&(!q.parking||p.parking);}
function score(p,q){let n=70;if(q.maxPrice){n+=Math.min(15,Math.max(0,(Number(q.maxPrice)-p.price)/Number(q.maxPrice)*20));}if(q.bedrooms!==undefined&&q.bedrooms!=='')n+=p.bedrooms===Number(q.bedrooms)?10:5;if(q.parking&&p.parking)n+=5;return Math.min(100,Math.round(n));}

// V3 user accounts, sessions, favorites, bookings, and guided listing concierge.
const passwordHash=(p,salt)=>crypto.scryptSync(p,salt,64).toString('hex');
function setupV3(db){let changed=false;for(const [k,v] of Object.entries({users:[],favorites:[],visits:[],sessions:[]})){if(!Array.isArray(db[k])){db[k]=v;changed=true;}}
 if(!db.users.length){for(const [email,pass,role,name] of [['admin@primenest.demo','Admin123!','admin','Admin Demo'],['agent@primenest.demo','Agent123!','agent','Agent Demo'],['customer@primenest.demo','Customer123!','customer','Customer Demo']]){let salt=crypto.randomBytes(16).toString('hex');db.users.push({id:crypto.randomUUID(),email,name,role,salt,hash:passwordHash(pass,salt)});}changed=true;}
 for(const x of db.properties){if(!Array.isArray(x.images)){x.images=x.image?[x.image]:[];changed=true;}}
 if(changed)writeDb(db);return db;}
setupV3(readDb());
function userFrom(req,db){const token=(req.headers.authorization||'').replace(/^Bearer /,'');const ses=db.sessions.find(x=>x.token===token&&x.expires>Date.now());return ses?db.users.find(x=>x.id===ses.uid):null;}
function publicUser(u){return {id:u.id,name:u.name,email:u.email,role:u.role};}
function requireUser(req,res,db,roles){let u=userFrom(req,db);if(!u){error(res,401,'Please sign in');return null;}if(roles&&!roles.includes(u.role)){error(res,403,'Permission denied');return null;}return u;}
const cityCoords={Pune:[18.5204,73.8567],Mumbai:[19.076,72.8777],Bengaluru:[12.9716,77.5946],Hyderabad:[17.385,78.4867],Delhi:[28.6139,77.209],Noida:[28.5355,77.391],Gurugram:[28.4595,77.0266],Chennai:[13.0827,80.2707],Ahmedabad:[23.0225,72.5714],Kolkata:[22.5726,88.3639]};
function publicListing(p){return {...p,images:Array.isArray(p.images)?p.images:(p.image?[p.image]:[])};}
function extraApi(req,res,pathname,url,db){return (async()=>{
 if(pathname==='/api/auth/login'&&req.method==='POST'){const b=await parseBody(req);let u=db.users.find(u=>u.email===String(b.email||'').trim().toLowerCase());if(!u||passwordHash(String(b.password||''),u.salt)!==u.hash)return error(res,401,'Incorrect email or password');let token=crypto.randomBytes(32).toString('hex');db.sessions.push({token,uid:u.id,expires:Date.now()+7*864e5});writeDb(db);return send(res,200,{token,user:publicUser(u)});}
 if(pathname==='/api/auth/register'&&req.method==='POST'){const b=await parseBody(req);let email=String(b.email||'').trim().toLowerCase(),name=String(b.name||'').trim(),password=String(b.password||'');if(!/^\S+@\S+\.\S+$/.test(email)||name.length<2||password.length<8)return error(res,400,'Enter a name, valid email and password of at least 8 characters');if(db.users.some(u=>u.email===email))return error(res,409,'Email already registered');let salt=crypto.randomBytes(16).toString('hex'),u={id:crypto.randomUUID(),name,email,role:'customer',salt,hash:passwordHash(password,salt)};db.users.push(u);writeDb(db);return send(res,201,{user:publicUser(u)});}
 if(pathname==='/api/auth/me'&&req.method==='GET'){let u=userFrom(req,db);return send(res,200,{user:u?publicUser(u):null});}
 if(pathname==='/api/auth/logout'&&req.method==='POST'){let token=(req.headers.authorization||'').replace(/^Bearer /,'');db.sessions=db.sessions.filter(s=>s.token!==token);writeDb(db);return send(res,200,{ok:true});}
 if(pathname==='/api/favorites'&&req.method==='GET'){const u=requireUser(req,res,db);if(!u)return;return send(res,200,{items:db.favorites.filter(f=>f.userId===u.id).map(f=>db.properties.find(p=>p.id===f.propertyId)).filter(Boolean).map(publicListing)});}
 if(pathname==='/api/favorites'&&req.method==='POST'){const u=requireUser(req,res,db);if(!u)return;const b=await parseBody(req);if(!db.properties.some(p=>p.id===b.propertyId))return error(res,404,'Listing not found');const i=db.favorites.findIndex(f=>f.userId===u.id&&f.propertyId===b.propertyId);let saved=i<0;if(saved)db.favorites.push({userId:u.id,propertyId:b.propertyId});else db.favorites.splice(i,1);writeDb(db);return send(res,200,{saved});}
 if(pathname==='/api/visits'&&req.method==='GET'){const u=requireUser(req,res,db);if(!u)return;return send(res,200,{items:db.visits.filter(v=>u.role==='customer'?v.userId===u.id:true).slice().reverse()});}
 if(pathname==='/api/visits'&&req.method==='POST'){const u=requireUser(req,res,db);if(!u)return;const b=await parseBody(req);if(!db.properties.some(p=>p.id===b.propertyId))return error(res,404,'Listing not found');let date=String(b.date||''),time=String(b.time||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time)||new Date(date+'T'+time).getTime()<Date.now())return error(res,400,'Choose a future date and time');const item={id:crypto.randomUUID(),userId:u.id,userName:u.name,email:u.email,propertyId:b.propertyId,date,time,note:String(b.note||'').slice(0,300),status:'Requested',createdAt:new Date().toISOString()};db.visits.push(item);writeDb(db);return send(res,201,{item});}
 const vm=pathname.match(/^\/api\/visits\/([^/]+)$/);if(vm&&req.method==='PATCH'){const u=requireUser(req,res,db,['admin','agent']);if(!u)return;let item=db.visits.find(v=>v.id===vm[1]);if(!item)return error(res,404,'Visit not found');const b=await parseBody(req);if(!['Requested','Confirmed','Completed','Cancelled'].includes(b.status))return error(res,400,'Invalid status');item.status=b.status;writeDb(db);return send(res,200,{item});}
 if(pathname==='/api/overview'&&req.method==='GET'){const u=requireUser(req,res,db,['admin','agent']);if(!u)return;let counts={};for(const p of db.properties)counts[p.city]=(counts[p.city]||0)+1;return send(res,200,{properties:db.properties.length,sale:db.properties.filter(p=>p.purpose==='Sale').length,rent:db.properties.filter(p=>p.purpose==='Rent').length,enquiries:db.enquiries.length,visits:db.visits.length,favorites:db.favorites.length,cities:Object.entries(counts).sort((a,b)=>b[1]-a[1]),recent:db.visits.slice(-6).reverse()});}
 if(pathname==='/api/map'&&req.method==='GET'){let locations=Object.entries(cityCoords).map(([city,coords])=>({city,lat:coords[0],lng:coords[1],count:db.properties.filter(p=>p.city===city).length}));return send(res,200,{locations,precision:'city-centre approximate; not listing coordinates'});}
 if(pathname==='/api/concierge'&&req.method==='POST'){let b=await parseBody(req),prompt=String(b.message||'').slice(0,500),lower=prompt.toLowerCase();let city=Object.keys(cityCoords).find(c=>lower.includes(c.toLowerCase()))||String(b.city||'');let purpose=/\brent|rental|lease|tenant\b/i.test(prompt)?'Rent':/\bbuy|purchase|sale\b/i.test(prompt)?'Sale':b.purpose||'';let bhk=lower.match(/(\d)\s*(bhk|bedroom)/);let budget=lower.match(/(?:under|below|upto|up to|max(?:imum)?|budget(?: of)?)[^\d₹]{0,12}₹?\s*([\d.]+)\s*(lakh|lac|k|thousand|crore)?/i);let maxPrice=budget?Number(budget[1])*(/crore/i.test(budget[2]||'')?100:/lakh|lac/i.test(budget[2]||'')?1:purpose==='Rent'?( /thousand|k/i.test(budget[2]||'')?1:1):1):Number(b.maxPrice||0);let q={city,purpose,maxPrice,bedrooms:bhk?Number(bhk[1]):Number(b.bedrooms||0),parking:/parking (required|must|needed)|with parking/i.test(prompt)};let items=db.properties.filter(p=>matches(p,q)).sort((a,b)=>a.price-b.price).slice(0,5).map(publicListing);let needs=[];if(!q.city)needs.push('city');if(!q.purpose)needs.push('buy or rent');if(!q.maxPrice)needs.push('maximum budget');let reply=needs.length?'I can help with your property search. Please specify '+needs.join(', ')+'.':items.length?`I found ${items.length} suitable sample listings for your preferences. Here are options from the verified local demo catalogue:`:'No properties in the current catalogue meet all those requirements. Consider adjusting your budget, bedrooms, or location.';return send(res,200,{reply,items,interpreted:q,mode:'Rule-based local concierge (no external LLM)'});}
 return null;
})();}

const contentTypes={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const server=http.createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://localhost'); const pathname=url.pathname;
 if(pathname.startsWith('/api/')){
  const db=readDb();
  if(['/api/auth/login','/api/auth/register','/api/auth/me','/api/auth/logout','/api/favorites','/api/visits','/api/overview','/api/map','/api/concierge'].includes(pathname)||/^\/api\/visits\/[^/]+$/.test(pathname)){return await extraApi(req,res,pathname,url,db);}
  if(pathname==='/api/properties'&&req.method==='GET'){
   let items=db.properties.filter(p=>matches(p,Object.fromEntries(url.searchParams)));
   const q=String(url.searchParams.get('q')||'').trim().toLowerCase();
   if(q)items=items.filter(p=>[p.title,p.city,p.locality,p.description,p.id].some(x=>String(x||'').toLowerCase().includes(q)));
   const sort=url.searchParams.get('sort');if(sort==='priceAsc')items.sort((a,b)=>a.price-b.price);else if(sort==='priceDesc')items.sort((a,b)=>b.price-a.price);else if(sort==='newest')items.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));else items.sort((a,b)=>Number(b.featured)-Number(a.featured));
   return send(res,200,{items,total:items.length});
  }
  if(pathname==='/api/stats'&&req.method==='GET')return send(res,200,{properties:db.properties.length,sale:db.properties.filter(p=>p.purpose==='Sale').length,rent:db.properties.filter(p=>p.purpose==='Rent').length,enquiries:db.enquiries.length,cities:[...new Set(db.properties.map(p=>p.city))].sort()});
  if(pathname==='/api/match'&&req.method==='POST'){
   const q=await parseBody(req);if(!['Sale','Rent'].includes(q.purpose))return error(res,400,'Choose buying or renting');if(!Number.isFinite(Number(q.maxPrice))||Number(q.maxPrice)<=0)return error(res,400,'Enter a valid maximum budget');
   let items=db.properties.filter(p=>matches(p,q)).map(p=>({...p,matchScore:score(p,q),reasons:[`Located in ${p.city}${p.locality?', '+p.locality:''}`,`Within your ${q.purpose==='Sale'?'purchase':'monthly rent'} budget`,`${p.bedrooms} bedroom${p.bedrooms===1?'':'s'} available`,...(q.parking?['Parking included']:[])]}));items.sort((a,b)=>b.matchScore-a.matchScore||a.price-b.price);return send(res,200,{items,total:items.length,method:'Rule-based recommendation demo, not an AI model'});
  }
  if(pathname==='/api/properties'&&req.method==='POST'){
   const u=requireUser(req,res,db,['admin','agent']);if(!u)return;const body=await parseBody(req);let problem=validProperty(body);if(problem)return error(res,400,problem);const item={...cleanProperty(body),id:'PN'+crypto.randomBytes(3).toString('hex').toUpperCase(),createdAt:new Date().toISOString()};db.properties.unshift(item);writeDb(db);return send(res,201,{item});
  }
  const pMatch=pathname.match(/^\/api\/properties\/([^/]+)$/);
  if(pMatch&&['PUT','DELETE'].includes(req.method)){
   const u=requireUser(req,res,db,['admin','agent']);if(!u)return;
   const i=db.properties.findIndex(p=>p.id===pMatch[1]);if(i===-1)return error(res,404,'Property not found');
   if(req.method==='DELETE'){db.properties.splice(i,1);writeDb(db);return send(res,200,{ok:true});}
   const body=await parseBody(req);let problem=validProperty(body);if(problem)return error(res,400,problem);db.properties[i]=cleanProperty(body,db.properties[i]);writeDb(db);return send(res,200,{item:db.properties[i]});
  }
  if(pathname==='/api/enquiries'&&req.method==='GET'){const u=requireUser(req,res,db,['admin','agent']);if(!u)return;return send(res,200,{items:db.enquiries.slice().reverse()});}
  if(pathname==='/api/enquiries'&&req.method==='POST'){
   let body=await parseBody(req);if(!body.name||!body.email||!body.propertyId)return error(res,400,'Name, email and property are required');if(!/^\S+@\S+\.\S+$/.test(body.email))return error(res,400,'Please enter a valid email');if(!db.properties.some(p=>p.id===body.propertyId))return error(res,404,'Property not found');
   const e={id:crypto.randomUUID(),name:String(body.name).slice(0,90),email:String(body.email).slice(0,150),message:String(body.message||'').slice(0,500),propertyId:String(body.propertyId),createdAt:new Date().toISOString()};db.enquiries.push(e);writeDb(db);return send(res,201,{item:e});
  }
  return error(res,404,'Endpoint not found');
 }
 if(req.method!=='GET')return error(res,405,'Method not allowed');
 let file=path.join(publicDir,pathname==='/'?'index.html':pathname);
 if(!file.startsWith(publicDir+path.sep))return error(res,403,'Forbidden');
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':contentTypes[path.extname(file)]||'application/octet-stream'});res.end(data);});
 }catch(e){console.error(e);if(!res.headersSent)error(res,e.message==='Invalid JSON'?400:500,e.message==='Invalid JSON'?'Invalid JSON':'Server error');}
});
server.listen(PORT, '0.0.0.0', () => {
  console.log(`PrimeNest Realty running on port ${PORT}`);
});
