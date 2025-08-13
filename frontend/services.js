const API = 'http://localhost:3000/api';

async function load() {
  const res = await fetch(API + '/clients');
  const data = await res.json();
  const tb = document.getElementById('tbody');
  tb.innerHTML = data.map(c => `
    <tr>
      <td>${c.id}</td>
      <td><input value="${c.full_name||''}" data-id="${c.id}" data-k="client_name"></td>
      <td><input value="${c.email||''}" data-id="${c.id}" data-k="client_email"></td>
      <td><input value="${c.phone||''}" data-id="${c.id}" data-k="client_phone"></td>
      <td><input value="${c.doc_id||''}" data-id="${c.id}" data-k="client_document"></td>
      <td>
        <button onclick="save(${c.id})">save</button>
        <button onclick="del(${c.id})">Delete</button>
      </td>
    </tr>
  `).join('');
}

async function create() {
  const payload = {
    client_name: document.getElementById('name').value,
    client_email: document.getElementById('email').value,
    client_phone: document.getElementById('phone').value,
    client_document: document.getElementById('doc').value
  };
  const res = await fetch(API + '/clients', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload)
  });
  if (res.status === 201) {
    document.getElementById('name').value='';
    document.getElementById('email').value='';
    document.getElementById('phone').value='';
    document.getElementById('doc').value='';
    load();
  } else {
    alert('Create failed');
  }
}

async function save(id) {
  const inputs = [...document.querySelectorAll(`input[data-id="${id}"]`)];
  const payload = Object.fromEntries(inputs.map(i => [i.dataset.k, i.value]));
  const res = await fetch(`${API}/clients/${id}`, {
    method: 'PUT',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  if (res.status === 200) load(); else alert('Update failed');
}

async function del(id) {
  if (!confirm('Delete this client?')) return;
  const res = await fetch(`${API}/clients/${id}`, { method: 'DELETE' });
  if (res.status === 204) load(); else alert('Delete failed');
}

load();