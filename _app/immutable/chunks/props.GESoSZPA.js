import{S as x,o as j,q as k,u as z,v as N,U as d,w,x as L,y as H,z as Z,A as $,b as G,B,e as q,C,h as D,d as J,E as Q,D as V,F as W,k as X,G as M,g as p,I as ee,P as re,J as te,K as U,L as ae,R as ne,M as K,N as fe,O as ie,Q as se,T as ue,V as le}from"./runtime.ChUF1c7h.js";import{e as m,f as h,g as ve,m as _e}from"./disclose-version.CxFIN6Yi.js";function S(f,u=null,b){if(typeof f!="object"||f===null||x in f)return f;const g=Z(f);if(g!==j&&g!==k)return f;var i=new Map,v=$(f),_=m(0);v&&i.set("length",m(f.length));var l;return new Proxy(f,{defineProperty(a,e,r){(!("value"in r)||r.configurable===!1||r.enumerable===!1||r.writable===!1)&&z();var t=i.get(e);return t===void 0?(t=m(r.value),i.set(e,t)):h(t,S(r.value,l)),!0},deleteProperty(a,e){var r=i.get(e);if(r===void 0)e in a&&i.set(e,m(d));else{if(v&&typeof e=="string"){var t=i.get("length"),n=Number(e);Number.isInteger(n)&&n<t.v&&h(t,n)}h(r,d),Y(_)}return!0},get(a,e,r){var c;if(e===x)return f;var t=i.get(e),n=e in a;if(t===void 0&&(!n||(c=N(a,e))!=null&&c.writable)&&(t=m(S(n?a[e]:d,l)),i.set(e,t)),t!==void 0){var s=w(t);return s===d?void 0:s}return Reflect.get(a,e,r)},getOwnPropertyDescriptor(a,e){var r=Reflect.getOwnPropertyDescriptor(a,e);if(r&&"value"in r){var t=i.get(e);t&&(r.value=w(t))}else if(r===void 0){var n=i.get(e),s=n==null?void 0:n.v;if(n!==void 0&&s!==d)return{enumerable:!0,configurable:!0,value:s,writable:!0}}return r},has(a,e){var s;if(e===x)return!0;var r=i.get(e),t=r!==void 0&&r.v!==d||Reflect.has(a,e);if(r!==void 0||L!==null&&(!t||(s=N(a,e))!=null&&s.writable)){r===void 0&&(r=m(t?S(a[e],l):d),i.set(e,r));var n=w(r);if(n===d)return!1}return t},set(a,e,r,t){var T;var n=i.get(e),s=e in a;if(v&&e==="length")for(var c=r;c<n.v;c+=1){var y=i.get(c+"");y!==void 0?h(y,d):c in a&&(y=m(d),i.set(c+"",y))}n===void 0?(!s||(T=N(a,e))!=null&&T.writable)&&(n=m(void 0),h(n,S(r,l)),i.set(e,n)):(s=n.v!==d,h(n,S(r,l)));var P=Reflect.getOwnPropertyDescriptor(a,e);if(P!=null&&P.set&&P.set.call(t,r),!s){if(v&&typeof e=="string"){var I=i.get("length"),R=Number(e);Number.isInteger(R)&&R>=I.v&&h(I,R+1)}Y(_)}return!0},ownKeys(a){w(_);var e=Reflect.ownKeys(a).filter(n=>{var s=i.get(n);return s===void 0||s.v!==d});for(var[r,t]of i)t.v!==d&&!(r in a)&&e.push(r);return e},setPrototypeOf(){H()}})}function Y(f,u=1){h(f,f.v+u)}function ge(f,u,b,g=null,i=!1){D&&J();var v=f,_=null,l=null,a=null,e=i?Q:0;G(()=>{if(a===(a=!!u()))return;let r=!1;if(D){const t=v.data===V;a===t&&(v=W(),X(v),M(!1),r=!0)}a?(_?B(_):_=q(()=>b(v)),l&&C(l,()=>{l=null})):(l?B(l):g&&(l=q(()=>g(v))),_&&C(_,()=>{_=null})),r&&M(!0)},e),D&&(v=p)}function de(f){for(var u=L,b=L;u!==null&&!(u.f&(ae|ne));)u=u.parent;try{return K(u),f()}finally{K(b)}}function ye(f,u,b,g){var F;var i=(b&fe)!==0,v=!ie,_=(b&se)!==0,l=(b&le)!==0,a=!1,e;_?[e,a]=ve(()=>f[u]):e=f[u];var r=(F=N(f,u))==null?void 0:F.set,t=g,n=!0,s=!1,c=()=>(s=!0,n&&(n=!1,l?t=U(g):t=g),t);e===void 0&&g!==void 0&&(r&&v&&ee(),e=c(),r&&r(e));var y;if(y=()=>{var o=f[u];return o===void 0?c():(n=!0,s=!1,o)},!(b&re))return y;if(r){var P=f.$$legacy;return function(o,E){return arguments.length>0?((!E||P||a)&&r(E?y():o),o):y()}}var I=!1,R=!1,T=_e(e),A=de(()=>ue(()=>{var o=y(),E=w(T);return I?(I=!1,R=!0,E):(R=!1,T.v=o)}));return i||(A.equals=te),function(o,E){if(arguments.length>0){const O=E?w(A):_?S(o):o;return A.equals(O)||(I=!0,h(T,O),s&&t!==void 0&&(t=O),U(()=>w(A))),o}return w(A)}}export{S as a,ge as i,ye as p};
