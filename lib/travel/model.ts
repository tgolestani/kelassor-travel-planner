import { z } from 'zod';
export const CATEGORIES=['stay','activity','shopping','grocery','fuel'] as const;
export type Category=typeof CATEGORIES[number];
export const labels:Record<Category,string>={stay:'هتل و اقامتگاه‌ها',activity:'دیدنی‌ها و تفریحات',shopping:'مراکز خرید و سوغات',grocery:'خوار و بار',fuel:'بنزین و مراکز سوخت'};
export const category=z.enum(CATEGORIES);
export const money=z.number().int().min(0).max(1_000_000_000_000);
export const rowSchema=z.object({id:z.string().min(1).max(80),title:z.string().trim().min(1).max(120),quantity:z.number().int().min(1).max(10000),unitPrice:money});
export type EstimateRow=z.infer<typeof rowSchema>;
export const sumRows=(rows:EstimateRow[])=>rows.reduce((s,r)=>s+r.quantity*r.unitPrice,0);
export const digits=(s:string)=>s.replace(/[۰-۹٠-٩]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.includes(c)?'۰۱۲۳۴۵۶۷۸۹'.indexOf(c):'٠١٢٣٤٥٦٧٨٩'.indexOf(c)));
export const phoneSchema=z.string().transform(s=>digits(s).replace(/[\s-]/g,'').replace(/^\+98/,'0')).pipe(z.string().regex(/^09\d{9}$/,'شماره همراه معتبر وارد کنید.'));
export function nights(start:string|null,end:string|null){return start&&end?Math.round((Date.parse(end)-Date.parse(start))/86400000):0;}
export const dateSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
export const datesSchema=z.object({start:dateSchema,end:dateSchema}).refine(v=>nights(v.start,v.end)>0&&nights(v.start,v.end)<=90,'بازه سفر باید بین ۱ تا ۹۰ شب باشد.');
export type Place={id:string;category:Category;name:string;lat:number;lon:number;address:string;website:string|null;image:string|null;source:string;sourceUrl:string;price:number|null;priceBasis:string|null;updatedAt:number};
export type Item=Place&{itemId:string;day:number|null;time:string|null;rooms:number|null;restaurant:boolean;bookingStatus:'considering'|'selected'|'booked';estimatedCost:number|null;actualCost:number|null;addedBy:string;comments:{id:string;userId:string;name:string;body:string;createdAt:number}[];reactions:{userId:string;value:number}[]};
export type Trip={id:string;ownerId:string;destination:string;month:string;start:string|null;end:string|null;createdAt:number};
export type Member={id:string;name:string;userId:string|null;phone:string|null;role:string};
export type Budget={category:Category;amount:number|null;rows:EstimateRow[];revision:number};
export type Detail={trip:Trip;members:Member[];items:Item[];budgets:Budget[];route:{itemIds:string[];revision:number}};
export function safeUrl(v:unknown){if(typeof v!=='string')return null;try{const u=new URL(v);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
