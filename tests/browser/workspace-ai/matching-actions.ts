import { notice,need } from '../../acceptance/fixtures/opportunity-match-fixtures'
import { matchOpportunity } from '../../../src/features/workspace-finance/lib/opportunity-matching'
import type { ResourceOpportunityMatch,ResourceMatchTarget } from '../../../src/features/workspace-finance/matching-types'
const key='resource-matches-fixture'
const read=():ResourceOpportunityMatch[]=>JSON.parse(localStorage.getItem(key)??'[]')
const write=(rows:ResourceOpportunityMatch[])=>{localStorage.setItem(key,JSON.stringify(rows));return{matches:rows,opportunity:null}}
export async function getResourceOpportunityMatches(target:ResourceMatchTarget){return{matches:read().filter(m=>m.need.resourceId===target.resourceId),opportunity:null}}
export async function findResourceOpportunityMatches(input:{target:ResourceMatchTarget;keyword:string}){
 if(input.keyword==='unavailable')return{error:'Official details are temporarily unavailable. Try again later.'}
 const n={...notice(),title:'Fictional opportunity — browser test',verifiedAt:new Date().toISOString(),discoveredAt:new Date().toISOString()}
 const f={...need(),resourceId:input.target.resourceId,resourceRevision:input.target.resourceRevision}
 const row:ResourceOpportunityMatch={id:crypto.randomUUID(),updatedAt:new Date().toISOString(),need:f,notice:n,assessment:matchOpportunity(n,f),status:'new',stale:false,opportunityId:null}
 return {...write([row]),found:1,unavailable:0}
}
export async function updateResourceOpportunityMatch(input:{id:string;updatedAt:string;action:'save'|'dismiss'|'restore'}){
 const rows=read(),row=rows.find(m=>m.id===input.id)
 if(!row||row.updatedAt!==input.updatedAt)return{error:'Match changed. Refresh before retrying.'}
 row.status=input.action==='dismiss'?'dismissed':input.action==='save'?'saved':row.opportunityId?'saved':'new'
 if(input.action==='save')row.opportunityId=crypto.randomUUID()
 row.updatedAt=new Date().toISOString();return write(rows)
}
