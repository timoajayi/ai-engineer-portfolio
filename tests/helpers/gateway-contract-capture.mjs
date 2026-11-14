import { loadGatewayModules } from './chat-gateway-loader.mjs';
import * as net from 'node:net';
import * as dns from 'node:dns';
// Fail closed even when this optional contract check runs without an outer guard.
net.Socket.prototype.connect = () => { throw new Error('Offline contract check'); };
dns.default.lookup = () => { throw new Error('Offline contract check'); };
globalThis.fetch = () => { throw new Error('Offline contract check'); };
import { readFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
const root='../';
const f=JSON.parse(readFileSync(new URL(root+'fixtures/gateway_assertions_v1.json',import.meta.url)));
const {gateway,identity}=loadGatewayModules();
const config={CHAT_ENABLED:'true',APP_ORIGIN:'https://portfolio.example.test',AI_ASSISTANT_BACKEND_URL:'https://backend.example.test',
 AI_ASSISTANT_CHAT_TOKEN:'c'.repeat(43),AI_ASSISTANT_BACKEND_TOKEN:'i'.repeat(43),GATEWAY_ASSERTION_ISSUER:f.policy.issuer,
 GATEWAY_ASSERTION_AUDIENCE:f.policy.audience,GATEWAY_ASSERTION_KEY_ID:f.policy.currentKey.kid,
 GATEWAY_ASSERTION_KEY:Buffer.from(f.policy.currentKey.secret_hex,'hex').toString('base64url'),
 GATEWAY_ASSERTION_KEY_NOT_BEFORE:String(f.policy.currentKey.notBefore),GATEWAY_ASSERTION_KEY_NOT_AFTER:String(f.policy.currentKey.notAfter),
 GATEWAY_INGRESS_POLICY:f.policy.ipSource};
const captures=[];
class Evidence extends identity.TrustedVisitorIdentityProvider {
 constructor(ip,policy=config.GATEWAY_INGRESS_POLICY){super(policy);this.ip=ip;}
 async resolveEvidence(c){return {visitorIP:this.ip,ingressPolicy:config.GATEWAY_INGRESS_POLICY,requestId:c.requestId,evidenceId:'independent-offline-fixture'};}
}
function make(provider,settings={}) {
 return gateway.createChatGateway({readEnvironment:()=>({...config,...settings}),identityProvider:provider,now:()=>f.now*1000,
 fetch:async(url,init)=>{captures.push({url,headers:init.headers,body_base64:Buffer.from(init.body).toString('base64')});return Response.json({answer:'Offline response.'});}});
}
function request(headers={},suffix='') {return new Request(config.APP_ORIGIN+'/api/chat'+suffix,{method:'POST',headers:{Origin:config.APP_ORIGIN,
 'Content-Type':'application/json',Cookie:'__Host-portfolio-chat='+f.session_token,...headers},body:JSON.stringify({message:' Tourism — café 😀 '})});}
let negative=0;
for(const [headers,settings,provider,status,suffix] of [
 [{Origin:'https://attacker.test'},{},new Evidence('192.0.2.42'),403,''],
 [{Cookie:'__Host-portfolio-chat=invalid'},{},new Evidence('192.0.2.42'),401,''],
 [{Authorization:'Bearer browser-value'},{},new Evidence('192.0.2.42'),403,''],
 [{'X-Forwarded-For':'192.0.2.42'},{},new Evidence('192.0.2.42'),403,''],
 [{},{AI_ASSISTANT_CHAT_TOKEN:undefined},new Evidence('192.0.2.42'),503,''],
 [{},{},undefined,503,''],
 [{},{},{authorizedIdentity:()=>({visitorIP:'192.0.2.42'})},503,''],
 [{},{},new Evidence('192.0.2.42','other-policy'),503,''],
 [{},{},new Evidence('2001:DB8::1'),503,''],
 [{},{},new Evidence('192.0.2.42'),400,'?token=PRIVATE'],
]) {
 const before=captures.length;
 const result=await make(provider,settings)(request(headers,suffix));
 if(result.status!==status || captures.length!==before)throw new Error('Independent rejection failed');
 const text=await result.text();
 for(const value of [f.session_token,config.AI_ASSISTANT_CHAT_TOKEN,config.GATEWAY_ASSERTION_KEY,'192.0.2.42'])if(text.includes(value))throw new Error('Sensitive response');
 negative++;
}
for(const ip of ['192.0.2.42','2001:db8::1','2001:db8:0:1::1']){
 const result=await make(new Evidence(ip))(request());
 if(result.status!==200)throw new Error('Cross-language capture failed');
}
console.log(JSON.stringify({negative,captures}));
