// Private static implementation of frozen bibley.source.v1. No model loading or network calls.
export class SourceConnector {
  constructor(contract) {
    if (contract?.schema_id !== 'bibley.source.v1') throw new Error('Unsupported source contract');
    this.contract = contract;
    this.policy = contract.serialization.policy;
    this.kinds = new Set(contract.input.record_kind_enum);
  }
  validateHistory(history) {
    if (!Array.isArray(history) || history.length % 2 || history.some((m,i) => m?.role !== (i % 2 ? 'assistant' : 'user') || typeof m.content !== 'string')) throw new Error('Actual alternating user/assistant history pairs required');
    return history.map(({role,content}) => ({role,content}));
  }
  record(record) {
    const required = ['id','author','work','edition','section','kind','text','source_url'];
    if (!record || required.some(k => !(k in record))) throw new Error('Incomplete source metadata');
    for (const k of ['id','work','edition','section','kind','text']) if (typeof record[k] !== 'string' || !record[k].trim()) throw new Error('Invalid source field: '+k);
    for (const k of ['author','source_url']) if (record[k] !== null && typeof record[k] !== 'string') throw new Error('Invalid nullable source field: '+k);
    if (!this.kinds.has(record.kind)) throw new Error('Unknown source kind');
    return Object.fromEntries(required.map(k => [k,record[k]]));
  }
  messages(question, history=[], records=[]) {
    if (typeof question !== 'string' || !question.trim()) throw new Error('Question required');
    const h=this.validateHistory(history), evidence=records.map(r => this.record(r));
    if (new Set(evidence.map(r=>r.id)).size !== evidence.length) throw new Error('Duplicate evidence IDs');
    const payload=JSON.stringify({question,untrusted_source_evidence:evidence});
    if(h.length)h[0].content=this.policy+'\n'+h[0].content;
    return [...h,{role:'user',content:h.length?payload:this.policy+'\n'+payload}];
  }
  async prepare(question,{history=[],records=[],measureMessages,contextLimit,fixedEvaluationPacket=false}={}) {
    if(typeof measureMessages !== 'function' || !Number.isInteger(contextLimit) || contextLimit<=420) throw new Error('Actual tokenizer and context limit required');
    const limit=Math.min(contextLimit,4096), reserve=420;
    let chosen=[], messages=this.messages(question,history,[]), promptTokens=await measureMessages(messages);
    if(!Number.isInteger(promptTokens)||promptTokens<1)throw new Error('Invalid tokenizer count');
    if(promptTokens+reserve>limit)return {status:'context_limit',schema_id:'bibley.source.v1',messages:null,model_called:false,omitted_evidence_ids:records.map(r=>r.id),reason:'Question/history do not fit; nothing silently cropped'};
    const normalized=records.map(r=>this.record(r));
    if(new Set(normalized.map(r=>r.id)).size!==normalized.length)throw new Error('Duplicate evidence IDs');
    const omitted=[];
    for(const record of normalized){
      const candidate=[...chosen,record], next=this.messages(question,history,candidate), count=await measureMessages(next);
      if(!Number.isInteger(count)||count<1)throw new Error('Invalid tokenizer count');
      if(count+reserve<=limit){chosen=candidate;messages=next;promptTokens=count;}else omitted.push(record.id);
    }
    if(fixedEvaluationPacket && omitted.length)return {status:'context_limit',schema_id:'bibley.source.v1',messages:null,model_called:false,omitted_evidence_ids:omitted,reason:'Frozen evaluation evidence does not fit; packet not silently changed'};
    return {status:'prepared_not_generated',schema_id:'bibley.source.v1',messages,prompt_tokens:promptTokens,max_new_tokens:reserve,context_limit:limit,evidence:chosen,omitted_evidence_ids:omitted,model_called:false};
  }
  audit(raw,prepared){
    if(typeof raw!=='string'||prepared?.status!=='prepared_not_generated')throw new Error('Raw answer and prepared packet required');
    const ids=[...raw.matchAll(/\[([^\]\n]+)\]/g)].map(m=>m[1]),known=new Set(prepared.evidence.map(r=>r.id));
    const quotes=[...raw.matchAll(/"([^"\n]+)"|“([^”\n]+)”/g)].map(m=>m[1]||m[2]);
    return {valid_ids:ids.filter(id=>known.has(id)),unknown_ids:ids.filter(id=>!known.has(id)),quoted_substring_checks:quotes.map(text=>({text,exact_in_evidence:prepared.evidence.some(r=>r.text.includes(text))})),semantic_support_verified:false,answer_trustworthy:null,note:'Citation syntax and substring matches are not semantic review. Rejected false quotations may deliberately be absent.'};
  }
}
