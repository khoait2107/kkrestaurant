function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}
function fmt(n){const cents=Math.round(Number(n)||0);return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2,maximumFractionDigits:2}).format(cents/100)}
function getCart(){try{const c=JSON.parse(localStorage.getItem("kk_cart")||"[]");return Array.isArray(c)?c:[]}catch(e){return[]}}
function saveCart(c){localStorage.setItem("kk_cart",JSON.stringify(Array.isArray(c)?c:[]));updateCartCount();renderCart()}
function addToCart(id){let x=(window.MENU||[]).find(i=>i.id===id);if(!x)return;let c=getCart(),f=c.find(i=>i.id===id);f?f.qty=Math.min(99,(Number(f.qty)||0)+1):c.push({...x,qty:1});saveCart(c);openCart()}
function qty(id,d){let c=getCart(),x=c.find(i=>i.id===id);if(!x)return;x.qty=(Number(x.qty)||0)+Number(d||0);if(x.qty<1)c=c.filter(i=>i.id!==id);if(x.qty>99)x.qty=99;saveCart(c)}
function removeItem(id){saveCart(getCart().filter(i=>i.id!==id))}
function updateCartCount(){let e=document.getElementById("cart-count");if(e)e.textContent=getCart().reduce((s,x)=>s+Math.max(0,Number(x.qty)||0),0)}
function renderCart(){let b=document.getElementById("cart-items");if(!b)return;let c=getCart();b.innerHTML=c.length?c.map(x=>`<div class="cart-line"><div><b>${escapeHtml(x.name)}</b><div class="qty"><button onclick="qty('${escapeHtml(x.id)}',-1)">−</button><span>${Math.max(0,Number(x.qty)||0)}</span><button onclick="qty('${escapeHtml(x.id)}',1)">+</button><button onclick="removeItem('${escapeHtml(x.id)}')">×</button></div></div><b>${fmt((Number(x.price)||0)*(Number(x.qty)||0))}</b></div>`).join(""):"<p>Giỏ hàng trống.</p>";let e=document.getElementById("cart-subtotal");if(e)e.textContent=fmt(c.reduce((s,x)=>s+(Number(x.price)||0)*(Number(x.qty)||0),0))}
function openCart(){document.getElementById("drawer")?.classList.add("open");document.getElementById("backdrop")?.classList.add("open")}
function closeCart(){document.getElementById("drawer")?.classList.remove("open");document.getElementById("backdrop")?.classList.remove("open")}
document.addEventListener("DOMContentLoaded",()=>{updateCartCount();renderCart()})
