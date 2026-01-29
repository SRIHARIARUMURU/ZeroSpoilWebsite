// Local Storage keys
const USERS_KEY = 'zs_users';
const SESSION_KEY = 'zs_session';

function switchTab(which){
  document.getElementById('tabLogin').classList.toggle('active', which==='login');
  document.getElementById('tabRegister').classList.toggle('active', which==='register');
  document.getElementById('loginView').style.display = which==='login' ? 'block':'none';
  document.getElementById('registerView').style.display = which==='register' ? 'block':'none';
  document.getElementById('login_err').style.display='none';
  document.getElementById('reg_err').style.display='none';
}

function getUsers(){
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); }
  catch { return []; }
}
function setUsers(arr){ localStorage.setItem(USERS_KEY, JSON.stringify(arr)); }

async function hash(str){
  const enc = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function register(){
  const u = document.getElementById('reg_user').value.trim();
  const p = document.getElementById('reg_pass').value;
  const p2 = document.getElementById('reg_pass2').value;
  const err = document.getElementById('reg_err');
  err.style.display='none';

  if(!u || !p || !p2){ err.textContent='All fields are required.'; err.style.display='block'; return; }
  if(p.length < 6){ err.textContent='Password must be at least 6 characters.'; err.style.display='block'; return; }
  if(p!==p2){ err.textContent='Passwords do not match.'; err.style.display='block'; return; }

  const users = getUsers();
  if(users.some(x=>x.username.toLowerCase()===u.toLowerCase())){
    err.textContent='Username already exists.'; err.style.display='block'; return;
  }
  const ph = await hash(p);
  users.push({ username:u, passwordHash:ph, createdAt:new Date().toISOString() });
  setUsers(users);
  alert('Account created. You can sign in now.');
  switchTab('login');
}

async function login(){
  const u = document.getElementById('login_user').value.trim();
  const p = document.getElementById('login_pass').value;
  const remember = document.getElementById('remember').checked;
  const err = document.getElementById('login_err');
  err.style.display='none';

  if(!u || !p){ err.textContent='Enter username and password.'; err.style.display='block'; return; }

  const users = getUsers();
  const user = users.find(x=>x.username.toLowerCase()===u.toLowerCase());
  if(!user){ err.textContent='Invalid username or password.'; err.style.display='block'; return; }

  const ph = await hash(p);
  if(ph !== user.passwordHash){ err.textContent='Invalid username or password.'; err.style.display='block'; return; }

  const session = { username:user.username, loginAt:new Date().toISOString() };
  if(remember){ localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
  else { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); }

  window.location.href = 'app.html';
}

// Auto-redirect when already logged in
(function(){
  if(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY)){
    window.location.href = 'app.html';
  }
})();
