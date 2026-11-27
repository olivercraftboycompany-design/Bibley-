import {TheologySearch} from './retrieval.mjs';
import {SourceConnector} from './source-connector-v1.mjs';
// Pure adapter. It cannot load a model, fetch a corpus, or generate an answer.
export class TheologyBridge {
 constructor({documents,contract}) {
  if (!Array.isArray(documents) || !documents.length) throw new Error('A nonempty reviewed corpus is required');
  const ids=new Set();
  this.connector=new SourceConnector(contract);
  this.documents=documents.map(d=>{
   // Explicit migration of the older retrieval-v2 kind. Raw corpus remains unchanged.
   const migrated=d.kind==='theology-commentary'?{...d,kind:'historical_theology'}:d;
   const record=this.connector.record(migrated);
   if(ids.has(record.id))throw new Error('Duplicate corpus ID');ids.add(record.id);
   return {...d,...record};
  });
  this.search=new TheologySearch(this.documents);
 }
 async prepare(question,{history=[],source=null,k=4,measureMessages,contextLimit}={}) {
  if(!Number.isInteger(k)||k<1||k>8)throw new Error('k must be1to8');
  if(source!==null&&!this.documents.some(d=>d.source_key===source))throw new Error('Unknown source selection');
  // Validate even when retrieval has no matches. Never silently erase malformed history.
  this.connector.messages(question,history,[]);
  const candidates=this.search.search(question,{source,k});
  if(!candidates.length)return {status:'no_lexical_evidence',model_called:false,messages:null,evidence:[],omitted_evidence_ids:[],reason:'No lexical matches in this two-work collection. This does not mean the topic is absent from Christian literature.'};
  const result=await this.connector.prepare(question,{history,records:candidates,measureMessages,contextLimit});
  if(result.status==='prepared_not_generated'&&!result.evidence.length)return {...result,status:'no_evidence_fits',messages:null,reason:'No complete evidence record fits the context budget; do not generate a source-grounded answer from this packet.'};
  return {...result,corpus_scope:'Augustine Confessions(Pusey); Calvin Institutes(Allen),volume1only',retrieved_ids:candidates.map(d=>d.id),retrieval_scores:candidates.map(d=>({id:d.id,score:d.score,query_coverage:d.query_coverage})),semantic_relevance_verified:false};
 }
 inspectAnswer(raw,prepared){return this.connector.audit(raw,prepared);}
}
