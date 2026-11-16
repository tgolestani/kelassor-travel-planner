import { z } from 'zod';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import * as S from '@/db/schema';
import {category,phoneSchema,datesSchema,rowSchema,money,sumRows,nights} from '@/lib/travel/model';
import {catalogue,config,recommend,directions} from '@/lib/travel/providers';
export const dynamic='force-dynamic';
class HttpError extends Error{constructor(public status:number,message:string){super(message);}}
const id=z.string().min(1).max(100);
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
async function access(tripId:string,userId:string,owner=false){const db=getDb();const [trip]=await db.select().from(S.trips).where(eq(S.trips.id,tripId));if(!trip)throw new HttpError(404,'سفر پیدا نشد.');const [member]=await db.select().from(S.members).where(and(eq(S.members.tripId,tripId),eq(S.members.userId,userId)));if(!member||(owner&&trip.ownerId!==userId))throw new HttpError(403,'اجازه این تغییر را ندارید.');return trip;}
async function detail(tripId:string,userId:string){const db=getDb();const trip=await access(tripId,userId);const members=await db.select({id:S.members.id,name:S.members.name,userId:S.members.userId,phone:S.members.phone,role:S.members.role}).from(S.members).where(eq(S.members.tripId,tripId));if(trip.ownerId!==userId)members.forEach(m=>m.phone=null);
 const its=await db.select().from(S.items).innerJoin(S.places,eq(S.items.placeId,S.places.id)).where(eq(S.items.tripId,tripId));const ids=its.map(i=>i.items.id);
 const cs=ids.length?await db.select().from(S.comments).where(inArray(S.comments.itemId,ids)):[];const rs=ids.length?await db.select().from(S.reactions).where(inArray(S.reactions.itemId,ids)):[];
 const budgets=await db.select().from(S.budgets).where(eq(S.budgets.tripId,tripId));const [route]=await db.select().from(S.routes).where(eq(S.routes.tripId,tripId));
 return {trip,members,items:its.map(i=>({...i.places,...i.items,id:i.places.id,itemId:i.items.id,comments:cs.filter(c=>c.itemId===i.items.id),reactions:rs.filter(r=>r.itemId===i.items.id)})),budgets:budgets.map(b=>({...b,rows:JSON.parse(b.rows)})),route:route?{itemIds:JSON.parse(route.itemIds),revision:route.revision}:{itemIds:[],revision:0}};}
async function run(req:Request){const user=await getChatGPTUser();if(!user)throw new HttpError(401,'برای ادامه وارد حساب خود شوید.');const db=getDb();
 if(req.method==='GET'){
  const q=new URL(req.url).searchParams;const tripId=q.get('tripId');if(tripId)return json(await detail(id.parse(tripId),user.userId));
  const memberships=await db.select({tripId:S.members.tripId}).from(S.members).where(eq(S.members.userId,user.userId));const trips=memberships.length?await db.select().from(S.trips).where(inArray(S.trips.id,memberships.map(m=>m.tripId))):[];
  return json({user:{id:user.userId,name:user.displayName},trips,services:config()});
 }
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw new HttpError(403,'درخواست نامعتبر است.');
 if(Number(req.headers.get('content-length')||0)>50000)throw new HttpError(413,'درخواست بیش از حد بزرگ است.');
 const raw=await req.text();if(raw.length>50000)throw new HttpError(413,'درخواست بیش از حد بزرگ است.');const b=JSON.parse(raw);const op=z.string().parse(b.op);
 if(op==='create'){
  const v=z.object({destination:z.literal('اصفهان'),month:z.string().regex(/^14\d{2}\/(0[1-9]|1[0-2])$/),phones:z.array(phoneSchema).max(29)}).parse(b);const tripId=crypto.randomUUID();const phones=[...new Set(v.phones)];
  await db.batch([db.insert(S.trips).values({id:tripId,ownerId:user.userId,destination:v.destination,month:v.month,createdAt:Date.now()}),db.insert(S.members).values([{id:crypto.randomUUID(),tripId,userId:user.userId,name:user.displayName,role:'owner'},...phones.map(phone=>({id:crypto.randomUUID(),tripId,name:phone,phone,role:'member'}))]),db.insert(S.routes).values({tripId,itemIds:'[]',revision:0})]);return json(await detail(tripId,user.userId),201);
 }
 if(op==='join'){
  const token=z.string().uuid().parse(b.token);const [invite]=await db.select().from(S.members).where(eq(S.members.tokenHash,await hash(token)));if(!invite||invite.userId||!invite.expiresAt||invite.expiresAt<Date.now())throw new HttpError(400,'دعوت‌نامه معتبر نیست یا منقضی شده است.');
  const [existing]=await db.select().from(S.members).where(and(eq(S.members.tripId,invite.tripId),eq(S.members.userId,user.userId)));if(existing)throw new HttpError(409,'شما از قبل عضو این سفر هستید.');
  const claimed=await db.update(S.members).set({userId:user.userId,name:user.displayName,tokenHash:null,expiresAt:null}).where(and(eq(S.members.id,invite.id),eq(S.members.tokenHash,await hash(token)))).returning();if(!claimed.length)throw new HttpError(409,'این دعوت‌نامه قبلاً استفاده شده است.');return json(await detail(invite.tripId,user.userId));
 }
 const tripId=id.parse(b.tripId);const trip=await access(tripId,user.userId,['dates','budget','invite','member','removeMember','route','deleteTrip'].includes(op));
 if(op==='dates'){const v=datesSchema.parse(b);await db.update(S.trips).set(v).where(eq(S.trips.id,tripId));}
 else if(op==='catalogue'){return json({places:await catalogue(category.parse(b.category))});}
 else if(op==='add'){
  if(!trip.start||!trip.end)throw new HttpError(400,'ابتدا بازه سفر را مشخص کنید.');const placeId=id.parse(b.placeId);const [place]=await db.select().from(S.places).where(eq(S.places.id,placeId));if(!place)throw new HttpError(404,'گزینه معتبر نیست. فهرست را تازه کنید.');
  await db.insert(S.items).values({id:crypto.randomUUID(),tripId,placeId,addedBy:user.userId,createdAt:Date.now()}).onConflictDoNothing();
 }
 else if(op==='remove'||op==='item'||op==='comment'||op==='reaction'){
  const itemId=id.parse(b.itemId);const [item]=await db.select().from(S.items).where(and(eq(S.items.id,itemId),eq(S.items.tripId,tripId)));if(!item)throw new HttpError(404,'گزینه پیدا نشد.');
  if(op==='remove'||op==='item'){
   if(user.userId!==trip.ownerId&&user.userId!==item.addedBy)throw new HttpError(403,'فقط هماهنگ‌کننده یا اضافه‌کننده می‌تواند این گزینه را تغییر دهد.');
   if(op==='remove'){const [rt]=await db.select().from(S.routes).where(eq(S.routes.tripId,tripId));await db.batch([db.delete(S.comments).where(eq(S.comments.itemId,itemId)),db.delete(S.reactions).where(eq(S.reactions.itemId,itemId)),db.delete(S.items).where(eq(S.items.id,itemId)),db.update(S.routes).set({itemIds:JSON.stringify((rt?JSON.parse(rt.itemIds):[]).filter((i:string)=>i!==itemId)),revision:sql`${S.routes.revision}+1`}).where(eq(S.routes.tripId,tripId))]);}
   else{
    const v=z.object({day:z.number().int().min(1).max(nights(trip.start,trip.end)+1).nullable().optional(),time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),rooms:z.number().int().min(1).max(30).nullable().optional(),restaurant:z.boolean().optional(),bookingStatus:z.enum(['considering','selected','booked']).optional(),estimatedCost:money.nullable().optional(),actualCost:money.nullable().optional()}).parse(b);
    if(v.bookingStatus==='selected'&&trip.ownerId!==user.userId)throw new HttpError(403,'فقط هماهنگ‌کننده می‌تواند گزینه را برای رزرو انتخاب کند.');
    if(v.bookingStatus==='booked'&&v.actualCost==null&&item.actualCost==null)throw new HttpError(400,'برای ثبت رزرو، مبلغ نهایی را وارد کنید.');
    if(v.actualCost!=null&&v.actualCost>1e12)throw new HttpError(400,'مبلغ نهایی بیش از حد مجاز است.');
    if(v.bookingStatus==='selected'){
     const [place]=await db.select({category:S.places.category}).from(S.places).where(eq(S.places.id,item.placeId));
     const same=await db.select({itemId:S.items.id}).from(S.items).innerJoin(S.places,eq(S.items.placeId,S.places.id)).where(and(eq(S.items.tripId,tripId),eq(S.places.category,place.category),eq(S.items.bookingStatus,'selected')));
     const others=same.map(x=>x.itemId).filter(i=>i!==itemId);if(others.length)await db.update(S.items).set({bookingStatus:'considering'}).where(inArray(S.items.id,others));
    }
    await db.update(S.items).set(v).where(eq(S.items.id,itemId));
   }
  }else if(op==='comment'){const body=z.string().trim().min(1).max(2000).parse(b.body);await db.insert(S.comments).values({id:crypto.randomUUID(),itemId,userId:user.userId,name:user.displayName,body,createdAt:Date.now()});}
  else{const value=z.union([z.literal(1),z.literal(-1),z.literal(0)]).parse(b.value);if(!value)await db.delete(S.reactions).where(and(eq(S.reactions.itemId,itemId),eq(S.reactions.userId,user.userId)));else await db.insert(S.reactions).values({itemId,userId:user.userId,value}).onConflictDoUpdate({target:[S.reactions.itemId,S.reactions.userId],set:{value}});}
 }
 else if(op==='budget'){
  const v=z.object({category,amount:money.nullable(),rows:z.array(rowSchema).max(40),revision:z.number().int().nonnegative()}).parse(b);if(sumRows(v.rows)>1e12)throw new HttpError(400,'مجموع برآورد بیش از حد مجاز است.');
  const [existing]=await db.select().from(S.budgets).where(and(eq(S.budgets.tripId,tripId),eq(S.budgets.category,v.category)));
  if(existing){const updated=await db.update(S.budgets).set({amount:v.amount,rows:JSON.stringify(v.rows),revision:v.revision+1}).where(and(eq(S.budgets.tripId,tripId),eq(S.budgets.category,v.category),eq(S.budgets.revision,v.revision))).returning();if(!updated.length)throw new HttpError(409,'بودجه توسط فرد دیگری تغییر کرده است. صفحه را تازه کنید.');}
  else {const added=await db.insert(S.budgets).values({tripId,category:v.category,amount:v.amount,rows:JSON.stringify(v.rows),revision:1}).onConflictDoNothing().returning();if(!added.length)throw new HttpError(409,'بودجه تغییر کرده است. صفحه را تازه کنید.');}
 }
 else if(op==='member'){const phone=phoneSchema.parse(b.phone);const name=z.string().trim().min(1).max(80).parse(b.name);const members=await db.select().from(S.members).where(eq(S.members.tripId,tripId));if(members.length>=30)throw new HttpError(400,'حداکثر ۳۰ مسافر قابل ثبت است.');await db.insert(S.members).values({id:crypto.randomUUID(),tripId,phone,name,role:'member'}).onConflictDoNothing();}
 else if(op==='removeMember'){const memberId=id.parse(b.memberId);await db.delete(S.members).where(and(eq(S.members.id,memberId),eq(S.members.tripId,tripId),eq(S.members.role,'member')));}
 else if(op==='invite'){const memberId=id.parse(b.memberId);const token=crypto.randomUUID();const changed=await db.update(S.members).set({tokenHash:await hash(token),expiresAt:Date.now()+7*86400000}).where(and(eq(S.members.id,memberId),eq(S.members.tripId,tripId),sql`${S.members.userId} is null`)).returning();if(!changed.length)throw new HttpError(400,'این همسفر عضو شده یا حذف شده است.');return json({url:`${new URL(req.url).origin}/?invite=${token}`});}
 else if(op==='route'){
  const v=z.object({itemIds:z.array(id).max(20),revision:z.number().int().nonnegative()}).parse(b);if(new Set(v.itemIds).size!==v.itemIds.length)throw new HttpError(400,'مسیر تکراری نیست.');const its=await db.select().from(S.items).where(eq(S.items.tripId,tripId));if(v.itemIds.some(i=>!its.some(it=>it.id===i)))throw new HttpError(400,'فقط مکان‌های برنامه می‌توانند در مسیر باشند.');
  const changed=await db.update(S.routes).set({itemIds:JSON.stringify(v.itemIds),revision:v.revision+1}).where(and(eq(S.routes.tripId,tripId),eq(S.routes.revision,v.revision))).returning();if(!changed.length)throw new HttpError(409,'مسیر تغییر کرده است. صفحه را تازه کنید.');
 }
 else if(op==='directions'){const [rt]=await db.select().from(S.routes).where(eq(S.routes.tripId,tripId));const ids:string[]=JSON.parse(rt?.itemIds||'[]');if(ids.length<2)throw new HttpError(400,'حداقل دو مکان انتخاب کنید.');const its=await db.select().from(S.items).innerJoin(S.places,eq(S.items.placeId,S.places.id)).where(eq(S.items.tripId,tripId));const points=ids.map(i=>its.find(it=>it.items.id===i)?.places).filter((p):p is NonNullable<typeof p>=>Boolean(p));if(points.length!==ids.length)throw new HttpError(409,'مکان مسیر حذف شده است.');return json(await directions(points));}
 else if(op==='recommend'){
  const cat=category.parse(b.category);const prefs=z.string().max(1000).parse(b.preferences||'');const rooms=z.number().int().min(1).max(30).parse(b.rooms||1);const [budget]=await db.select().from(S.budgets).where(and(eq(S.budgets.tripId,tripId),eq(S.budgets.category,cat)));if(!budget?.amount)throw new HttpError(400,'ابتدا بودجه این دسته را وارد و ذخیره کنید.');if(!trip.start||!trip.end)throw new HttpError(400,'بازه سفر مشخص نیست.');
  const members=await db.select().from(S.members).where(eq(S.members.tripId,tripId));const candidates=await catalogue(cat);const options=await recommend({candidates,budget:budget.amount,destination:trip.destination,start:trip.start,end:trip.end,travelers:members.length,preferences:prefs,rooms});return json({options:options.map(o=>({...o,place:candidates.find(p=>p.id===o.id)})).filter(o=>o.place)});
 }else if(op==='deleteTrip'){await db.batch([db.delete(S.comments).where(sql`${S.comments.itemId} IN (SELECT id FROM items WHERE trip_id = ${tripId})`),db.delete(S.reactions).where(sql`${S.reactions.itemId} IN (SELECT id FROM items WHERE trip_id = ${tripId})`),db.delete(S.items).where(eq(S.items.tripId,tripId)),db.delete(S.budgets).where(eq(S.budgets.tripId,tripId)),db.delete(S.routes).where(eq(S.routes.tripId,tripId)),db.delete(S.members).where(eq(S.members.tripId,tripId)),db.delete(S.trips).where(eq(S.trips.id,tripId))]);return json({deleted:true});}
 else throw new HttpError(400,'عملیات ناشناخته است.');
 return json(await detail(tripId,user.userId));
}
async function handler(req:Request){try{return await run(req);}catch(e){if(e instanceof z.ZodError)return json({error:e.issues[0]?.message||'اطلاعات معتبر نیست.'},400);if(e instanceof HttpError)return json({error:e.message},e.status);if(e instanceof SyntaxError)return json({error:'ساختار درخواست معتبر نیست.'},400);console.error('travel request failed',e instanceof Error?e.message:'unknown');return json({error:e instanceof Error&&/[\u0600-\u06ff]/.test(e.message)?e.message:'درخواست انجام نشد. دوباره تلاش کنید.'},503);}}
export const GET=handler;export const POST=handler;
