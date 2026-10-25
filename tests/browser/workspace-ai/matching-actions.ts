import { notice,need } from '../../acceptance/fixtures/opportunity-match-fixtures'
import { matchOpportunity } from '../../../src/features/workspace-finance/lib/opportunity-matching'
import type { FundingReviewInput,ResourceOpportunityMatch,ResourceMatchTarget } from '../../../src/features/workspace-finance/matching-types'
import {applicationSectionId,opportunityApplicationSeed} from '../../../src/features/workspace-finance/lib/opportunity-application'
const key='resource-matches-fixture'
const read=():ResourceOpportunityMatch[]=>JSON.parse(localStorage.getItem(key)??'[]')
const write=(rows:ResourceOpportunityMatch[])=>{localStorage.setItem(key,JSON.stringify(rows));return{matches:rows,opportunity:null}}
export async function getResourceOpportunityMatches(target:ResourceMatchTarget){return{matches:read().filter(m=>m.need.resourceId===target.resourceId),opportunity:null}}
export async function findResourceOpportunityMatches(input:{target:ResourceMatchTarget;keyword:string}){
 if(input.keyword==='unavailable')return{error:'Official details are temporarily unavailable. Try again later.'}
 const n={...notice(),title:'Fictional opportunity — browser test',verifiedAt:new Date().toISOString(),discoveredAt:new Date().toISOString()}
 const f={...need(),resourceId:input.target.resourceId,resourceRevision:input.target.resourceRevision}
 const row:ResourceOpportunityMatch={id:crypto.randomUUID(),updatedAt:new Date().toISOString(),need:f,notice:n,assessment:matchOpportunity(n,f),status:'new',stale:false,opportunityId:null}
 const previous=read().find(item=>item.need.resourceId===input.target.resourceId)
 return {...write([previous??row]),found:1,unavailable:0}
}
export async function reviewResourceOpportunityMatch(input:{id:string;updatedAt:string;need:FundingReviewInput;target:ResourceMatchTarget}){
 const rows=read(),row=rows.find(m=>m.id===input.id)
 if(!row||row.updatedAt!==input.updatedAt)return{error:'Match changed. Reopen the review before retrying.'}
 const control=localStorage.getItem('matching-review-control');localStorage.removeItem('matching-review-control')
 if(control==='failure')return{error:'Official details are temporarily unavailable.'}
 if(control==='amendment'){
  row.notice.eligibilityText='Amended fictional requirements: local delivery is required.';row.updatedAt=new Date().toISOString()
  return{...write(rows),reviewRequired:true}
 }
 row.need={...input.need,review:{actorId:input.target.organizationId,reviewedAt:new Date().toISOString(),noticeFingerprint:'a'.repeat(64)}}
 row.assessment=matchOpportunity(row.notice,row.need);row.updatedAt=new Date().toISOString()
 return{...write(rows),reviewRequired:false}
}
export async function updateResourceOpportunityMatch(input:{id:string;updatedAt:string;action:'save'|'dismiss'|'restore'}){
 const rows=read(),row=rows.find(m=>m.id===input.id)
 if(!row||row.updatedAt!==input.updatedAt)return{error:'Match changed. Refresh before retrying.'}
 row.status=input.action==='dismiss'?'dismissed':input.action==='save'?'saved':row.opportunityId?'saved':'new'
 if(input.action==='save')row.opportunityId=crypto.randomUUID()
 row.updatedAt=new Date().toISOString();return write(rows)
}

export async function prepareResourceOpportunityApplication(input:{id:string;updatedAt:string;target:ResourceMatchTarget}){
 const rows=read(),row=rows.find(item=>item.id===input.id&&item.need.resourceId===input.target.resourceId)
 if(!row||row.status!=='saved'||row.updatedAt!==input.updatedAt)return{error:'Save the current opportunity first.'}
 if(localStorage.getItem('matching-application-control')==='not_accepting')return{matches:rows,document:null,reviewRequired:true,preparationWarning:"The funder's official solicitation says it is not accepting proposals. This conflicts with the listing; confirm availability with the funder before preparing a new application."}
 const documentKey=`matching-application:${applicationSectionId(row.id)}`
 const previous=localStorage.getItem(documentKey)
 const document=previous?JSON.parse(previous):{id:applicationSectionId(row.id),slug:applicationSectionId(row.id),...opportunityApplicationSeed(row.notice)}
 if(!previous)localStorage.setItem(documentKey,JSON.stringify(document))
 return{matches:rows,document,reviewRequired:false}
}
