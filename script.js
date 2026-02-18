// ============================================
//   ALMOXSYSTEM — LÓGICA PRINCIPAL
//   SUBSTITUA AS LINHAS ABAIXO PELOS SEUS DADOS
// ============================================

const SUPABASE_URL = 'COLE_AQUI_SEU_PROJECT_URL';
const SUPABASE_KEY = 'COLE_AQUI_SUA_ANON_KEY';

// ============================================
//   CLIENTE SUPABASE (NÃO MEXA AQUI)
// ============================================

const supa = {
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`
  },

  async get(tabela, filtros = '') {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?${filtros}`, { headers: this.headers });
    return r.json();
  },

  async post(tabela, dados) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}`, {
      method: 'POST',
      headers: { ...this.headers, 'Prefer': 'return=representation' },
      body: JSON.stringify(dados)
    });
    return r.json();
  },

  async patch(tabela, id, dados) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...this.headers, 'Prefer': 'return=representation' },
      body: JSON.stringify(dados)
    });
    return r.json();
  },

  async delete(tabela, id) {
    await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?id=eq.${id}`, {
      method: 'DELETE',
      headers: this.headers
    });
  },

  async signUp(email, senha, nome) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
      body: JSON.stringify({ email, password: senha, data: { nome } })
    });
    return r.json();
  },

  async signIn(email, senha) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
      body: JSON.stringify({ email, password: senha })
    });
    return r.json();
  },

  async signOut(token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${token}` }
    });
  },

  setToken(token) {
    this.headers['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('alx_token', token);
  },

  getToken() {
    return localStorage.getItem('alx_token');
  }
};

// ============================================
//   ESTADO DA APLICAÇÃO
// ============================================

let usuarioAtual = null;
let produtosCache = [];
let editandoProdutoId = null;

// ============================================
//   INICIALIZAÇÃO
// ============================================

window.addEventListener('DOMContentLoaded', () => {
  const token = supa.getToken();
  const userStr = localStorage.getItem('alx_user');
  if (token && userStr) {
    supa.setToken(token);
    usuarioAtual = JSON.parse(userStr);
    mostrarApp();
  } else {
    mostrarTela('login');
  }
});

// ============================================
//   NAVEGAÇÃO ENTRE TELAS
// ============================================

function mostrarTela(nome) {
  document.querySelectorAll('.tela').forEach(t => {
    t.classList.remove('ativa');
    t.style.display = 'none';
  });
  const tela = document.getElementById(`tela-${nome}`);
  if (tela) {
    tela.style.display = 'flex';
    tela.classList.add('ativa');
  }
}

function mostrarLogin() { mostrarTela('login'); }
function mostrarCadastro() { mostrarTela('cadastro'); }

function mostrarApp() {
  document.querySelectorAll('.tela').forEach(t => {
    t.classList.remove('ativa');
    t.style.display = 'none';
  });
  const app = document.getElementById('app');
  app.style.display = 'flex';

  if (usuarioAtual) {
    const nome = usuarioAtual.nome || usuarioAtual.email || 'Usuário';
    document.getElementById('user-name').textContent = nome;
    document.getElementById('user-role').textContent = usuarioAtual.perfil || 'operador';
    document.getElementById('user-avatar').textContent = nome.charAt(0).toUpperCase();
  }

  irPara('dashboard', document.querySelector('.nav-item.ativo'));
}

function irPara(secao, el) {
  document.querySelectorAll('.secao').forEach(s => s.classList.remove('ativa'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('ativo'));

  const sec = document.getElementById(`sec-${secao}`);
  if (sec) sec.classList.add('ativa');
  if (el) el.classList.add('ativo');

  if (secao === 'dashboard') carregarDashboard();
  if (secao === 'produtos') carregarProdutos();
  if (secao === 'entrada' || secao === 'saida') carregarSelectProdutos();
  if (secao === 'historico') carregarHistorico();
}

// ============================================
//   AUTENTICAÇÃO
// ============================================

async function fazerLogin() {
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  const erro = document.getElementById('login-erro');
  erro.style.display = 'none';

  if (!email || !senha) {
    erro.textContent = 'Preencha e-mail e senha.';
    erro.style.display = 'block';
    return;
  }

  const res = await supa.signIn(email, senha);

  if (res.error || !res.access_token) {
    erro.textContent = res.error?.message === 'Invalid login credentials'
      ? 'E-mail ou senha incorretos.'
      : (res.error?.message || 'Erro ao fazer login.');
    erro.style.display = 'block';
    return;
  }

  supa.setToken(res.access_token);

  // Buscar perfil do usuário
  const uid = res.user.id;
  const perfis = await supa.get('profiles', `id=eq.${uid}`);
  if (perfis && perfis.length > 0) {
    usuarioAtual = perfis[0];
  } else {
    usuarioAtual = { id: uid, email, nome: email.split('@')[0], perfil: 'operador' };
    await supa.post('profiles', usuarioAtual);
  }

  localStorage.setItem('alx_user', JSON.stringify(usuarioAtual));
  mostrarApp();
}

async function fazerCadastro() {
  const nome = document.getElementById('cad-nome').value.trim();
  const email = document.getElementById('cad-email').value.trim();
  const senha = document.getElementById('cad-senha').value;
  const erro = document.getElementById('cadastro-erro');
  const ok = document.getElementById('cadastro-ok');
  erro.style.display = 'none';
  ok.style.display = 'none';

  if (!nome || !email || !senha) {
    erro.textContent = 'Preencha todos os campos.';
    erro.style.display = 'block';
    return;
  }
  if (senha.length < 6) {
    erro.textContent = 'A senha deve ter pelo menos 6 caracteres.';
    erro.style.display = 'block';
    return;
  }

  const res = await supa.signUp(email, senha, nome);

  if (res.error) {
    erro.textContent = res.error.message || 'Erro ao criar conta.';
    erro.style.display = 'block';
    return;
  }

  ok.textContent = 'Conta criada! Verifique seu e-mail para confirmar e faça login.';
  ok.style.display = 'block';

  setTimeout(() => mostrarLogin(), 3000);
}

async function fazerLogout() {
  const token = supa.getToken();
  if (token) await supa.signOut(token);
  localStorage.removeItem('alx_token');
  localStorage.removeItem('alx_user');
  usuarioAtual = null;
  mostrarTela('login');
}

// ============================================
//   DASHBOARD
// ============================================

async function carregarDashboard() {
  const produtos = await supa.get('produtos', 'select=*');
  produtosCache = produtos || [];

  document.getElementById('stat-total').textContent = produtosCache.length;

  const hoje = new Date().toISOString().split('T')[0];
  const entradas = await supa.get('movimentacoes', `tipo=eq.entrada&data_movimentacao=gte.${hoje}T00:00:00`);
  const saidas = await supa.get('movimentacoes', `tipo=eq.saida&data_movimentacao=gte.${hoje}T00:00:00`);

  document.getElementById('stat-entradas').textContent = entradas?.length || 0;
  document.getElementById('stat-saidas').textContent = saidas?.length || 0;

  const baixo = produtosCache.filter(p => p.quantidade_atual <= p.estoque_minimo);
  document.getElementById('stat-baixo').textContent = baixo.length;

  const tbody = document.getElementById('tabela-baixo-estoque');
  if (baixo.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--texto2);padding:2rem">✓ Nenhum produto com estoque baixo</td></tr>';
  } else {
    tbody.innerHTML = baixo.map(p => {
      const critico = p.quantidade_atual === 0;
      const badge = critico ? 'badge-critico' : 'badge-baixo';
      const label = critico ? 'Zerado' : 'Baixo';
      return `<tr>
        <td>${p.codigo}</td>
        <td>${p.nome}</td>
        <td>${p.quantidade_atual} ${p.unidade}</td>
        <td>${p.estoque_minimo} ${p.unidade}</td>
        <td><span class="badge ${badge}">${label}</span></td>
      </tr>`;
    }).join('');
  }
}

// ============================================
//   PRODUTOS
// ============================================

async function carregarProdutos() {
  const produtos = await supa.get('produtos', 'select=*,categorias(nome)&order=nome.asc');
  produtosCache = produtos || [];
  renderizarProdutos(produtosCache);
}

function renderizarProdutos(lista) {
  const tbody = document.getElementById('tabela-produtos');
  if (!lista || lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--texto2);padding:2rem">Nenhum produto cadastrado. Clique em "+ Novo Produto" para começar.</td></tr>';
    return;
  }
  tbody.innerHTML = lista.map(p => {
    const categoria = p.categorias?.nome || '—';
    let badge = 'badge-ok'; let label = 'OK';
    if (p.quantidade_atual === 0) { badge = 'badge-critico'; label = 'Zerado'; }
    else if (p.quantidade_atual <= p.estoque_minimo) { badge = 'badge-baixo'; label = 'Baixo'; }
    return `<tr>
      <td>${p.codigo}</td>
      <td><strong>${p.nome}</strong>${p.descricao ? `<br><small style="color:var(--texto2)">${p.descricao}</small>` : ''}</td>
      <td>${categoria}</td>
      <td>${p.unidade}</td>
      <td><span class="badge ${badge}">${p.quantidade_atual} — ${label}</span></td>
      <td>${p.estoque_minimo}</td>
      <td>
        <button class="btn-tabela" onclick="editarProduto(${p.id})">Editar</button>
        <button class="btn-tabela danger" onclick="excluirProduto(${p.id}, '${p.nome}')">Excluir</button>
      </td>
    </tr>`;
  }).join('');
}

function buscarProdutos() {
  const termo = document.getElementById('busca-produto').value.toLowerCase();
  const filtrado = produtosCache.filter(p =>
    p.nome.toLowerCase().includes(termo) || p.codigo.toLowerCase().includes(termo)
  );
  renderizarProdutos(filtrado);
}

function abrirModalProduto() {
  editandoProdutoId = null;
  document.getElementById('modal-titulo').textContent = 'Novo Produto';
  document.getElementById('prod-codigo').value = '';
  document.getElementById('prod-nome').value = '';
  document.getElementById('prod-descricao').value = '';
  document.getElementById('prod-categoria-nome').value = '';
  document.getElementById('prod-unidade').value = 'un';
  document.getElementById('prod-qtd').value = '0';
  document.getElementById('prod-minimo').value = '0';
  document.getElementById('prod-id').value = '';
  document.getElementById('prod-erro').style.display = 'none';
  document.getElementById('modal-produto').style.display = 'flex';
}

function fecharModalProduto() {
  document.getElementById('modal-produto').style.display = 'none';
}

async function editarProduto(id) {
  const produto = produtosCache.find(p => p.id === id);
  if (!produto) return;
  editandoProdutoId = id;
  document.getElementById('modal-titulo').textContent = 'Editar Produto';
  document.getElementById('prod-codigo').value = produto.codigo;
  document.getElementById('prod-nome').value = produto.nome;
  document.getElementById('prod-descricao').value = produto.descricao || '';
  document.getElementById('prod-categoria-nome').value = produto.categorias?.nome || '';
  document.getElementById('prod-unidade').value = produto.unidade;
  document.getElementById('prod-qtd').value = produto.quantidade_atual;
  document.getElementById('prod-minimo').value = produto.estoque_minimo;
  document.getElementById('prod-id').value = id;
  document.getElementById('prod-erro').style.display = 'none';
  document.getElementById('modal-produto').style.display = 'flex';
}

async function salvarProduto() {
  const codigo = document.getElementById('prod-codigo').value.trim();
  const nome = document.getElementById('prod-nome').value.trim();
  const descricao = document.getElementById('prod-descricao').value.trim();
  const categoriaNome = document.getElementById('prod-categoria-nome').value.trim();
  const unidade = document.getElementById('prod-unidade').value;
  const quantidade = parseFloat(document.getElementById('prod-qtd').value) || 0;
  const minimo = parseFloat(document.getElementById('prod-minimo').value) || 0;
  const erro = document.getElementById('prod-erro');
  erro.style.display = 'none';

  if (!codigo || !nome) {
    erro.textContent = 'Código e nome são obrigatórios.';
    erro.style.display = 'block';
    return;
  }

  // Categoria
  let categoria_id = null;
  if (categoriaNome) {
    const cats = await supa.get('categorias', `nome=eq.${encodeURIComponent(categoriaNome)}`);
    if (cats && cats.length > 0) {
      categoria_id = cats[0].id;
    } else {
      const nova = await supa.post('categorias', { nome: categoriaNome });
      if (nova && nova[0]) categoria_id = nova[0].id;
    }
  }

  const dados = { codigo, nome, descricao, categoria_id, unidade, quantidade_atual: quantidade, estoque_minimo: minimo };

  if (editandoProdutoId) {
    await supa.patch('produtos', editandoProdutoId, dados);
  } else {
    const res = await supa.post('produtos', dados);
    if (res?.error || (Array.isArray(res) && res[0]?.code)) {
      erro.textContent = res?.message || res[0]?.message || 'Código já existe ou erro ao salvar.';
      erro.style.display = 'block';
      return;
    }
  }

  fecharModalProduto();
  carregarProdutos();
}

async function excluirProduto(id, nome) {
  if (!confirm(`Tem certeza que deseja excluir o produto "${nome}"?\n\nEssa ação não pode ser desfeita.`)) return;
  await supa.delete('produtos', id);
  carregarProdutos();
}

// ============================================
//   SELECT DE PRODUTOS (ENTRADA / SAÍDA)
// ============================================

async function carregarSelectProdutos() {
  const produtos = await supa.get('produtos', 'select=id,nome,codigo,quantidade_atual,unidade&order=nome.asc');
  produtosCache = produtos || [];

  ['ent-produto', 'sai-produto'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecione um produto...</option>' +
      produtosCache.map(p => `<option value="${p.id}">[${p.codigo}] ${p.nome} — ${p.quantidade_atual} ${p.unidade}</option>`).join('');
  });
}

// ============================================
//   ENTRADA
// ============================================

async function registrarEntrada() {
  const produto_id = document.getElementById('ent-produto').value;
  const quantidade = parseFloat(document.getElementById('ent-quantidade').value);
  const motivo = document.getElementById('ent-motivo').value.trim();
  const solicitante = document.getElementById('ent-fornecedor').value.trim();
  const erro = document.getElementById('entrada-erro');
  const ok = document.getElementById('entrada-ok');
  erro.style.display = 'none';
  ok.style.display = 'none';

  if (!produto_id || !quantidade || quantidade <= 0) {
    erro.textContent = 'Selecione um produto e informe a quantidade.';
    erro.style.display = 'block';
    return;
  }

  const produto = produtosCache.find(p => p.id == produto_id);
  const novaQtd = (produto?.quantidade_atual || 0) + quantidade;

  await supa.post('movimentacoes', {
    produto_id: parseInt(produto_id),
    tipo: 'entrada',
    quantidade,
    motivo,
    solicitante,
    responsavel_id: usuarioAtual?.id || null
  });

  await supa.patch('produtos', produto_id, { quantidade_atual: novaQtd });

  document.getElementById('ent-produto').value = '';
  document.getElementById('ent-quantidade').value = '';
  document.getElementById('ent-motivo').value = '';
  document.getElementById('ent-fornecedor').value = '';

  ok.textContent = `✓ Entrada registrada! Novo saldo de "${produto?.nome}": ${novaQtd} ${produto?.unidade}`;
  ok.style.display = 'block';
  carregarSelectProdutos();
}

// ============================================
//   SAÍDA
// ============================================

async function registrarSaida() {
  const produto_id = document.getElementById('sai-produto').value;
  const quantidade = parseFloat(document.getElementById('sai-quantidade').value);
  const solicitante = document.getElementById('sai-solicitante').value.trim();
  const departamento = document.getElementById('sai-departamento').value.trim();
  const motivo = document.getElementById('sai-motivo').value.trim();
  const erro = document.getElementById('saida-erro');
  const ok = document.getElementById('saida-ok');
  erro.style.display = 'none';
  ok.style.display = 'none';

  if (!produto_id || !quantidade || quantidade <= 0) {
    erro.textContent = 'Selecione um produto e informe a quantidade.';
    erro.style.display = 'block';
    return;
  }
  if (!solicitante) {
    erro.textContent = 'Informe o nome do solicitante.';
    erro.style.display = 'block';
    return;
  }

  const produto = produtosCache.find(p => p.id == produto_id);
  if (quantidade > (produto?.quantidade_atual || 0)) {
    erro.textContent = `Quantidade insuficiente em estoque. Disponível: ${produto?.quantidade_atual} ${produto?.unidade}.`;
    erro.style.display = 'block';
    return;
  }

  const novaQtd = (produto?.quantidade_atual || 0) - quantidade;

  await supa.post('movimentacoes', {
    produto_id: parseInt(produto_id),
    tipo: 'saida',
    quantidade,
    motivo,
    solicitante,
    departamento,
    responsavel_id: usuarioAtual?.id || null
  });

  await supa.patch('produtos', produto_id, { quantidade_atual: novaQtd });

  document.getElementById('sai-produto').value = '';
  document.getElementById('sai-quantidade').value = '';
  document.getElementById('sai-solicitante').value = '';
  document.getElementById('sai-departamento').value = '';
  document.getElementById('sai-motivo').value = '';

  ok.textContent = `✓ Saída registrada! Novo saldo de "${produto?.nome}": ${novaQtd} ${produto?.unidade}`;
  ok.style.display = 'block';
  carregarSelectProdutos();
}

// ============================================
//   HISTÓRICO
// ============================================

async function carregarHistorico() {
  const tipo = document.getElementById('filtro-tipo').value;
  const dataIni = document.getElementById('filtro-data-ini').value;
  const dataFim = document.getElementById('filtro-data-fim').value;

  let filtros = 'select=*,produtos(nome,codigo,unidade)&order=data_movimentacao.desc&limit=200';
  if (tipo) filtros += `&tipo=eq.${tipo}`;
  if (dataIni) filtros += `&data_movimentacao=gte.${dataIni}T00:00:00`;
  if (dataFim) filtros += `&data_movimentacao=lte.${dataFim}T23:59:59`;

  const movs = await supa.get('movimentacoes', filtros);
  const tbody = document.getElementById('tabela-historico');

  if (!movs || movs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--texto2);padding:2rem">Nenhuma movimentação encontrada.</td></tr>';
    return;
  }

  tbody.innerHTML = movs.map(m => {
    const data = new Date(m.data_movimentacao).toLocaleString('pt-BR');
    const badge = m.tipo === 'entrada' ? 'badge-entrada' : 'badge-saida';
    const label = m.tipo === 'entrada' ? '↓ Entrada' : '↑ Saída';
    const produto = m.produtos ? `${m.produtos.codigo} — ${m.produtos.nome}` : '—';
    return `<tr>
      <td>${data}</td>
      <td><span class="badge ${badge}">${label}</span></td>
      <td>${produto}</td>
      <td>${m.quantidade} ${m.produtos?.unidade || ''}</td>
      <td>${m.solicitante || '—'}</td>
      <td>${m.departamento || '—'}</td>
    </tr>`;
  }).join('');
}

// ============================================
//   RELATÓRIOS
// ============================================

async function gerarRelatorio(tipo) {
  const box = document.getElementById('resultado-relatorio');
  const titulo = document.getElementById('rel-titulo');
  const conteudo = document.getElementById('rel-conteudo');
  box.style.display = 'block';

  conteudo.innerHTML = '<p style="padding:1rem;color:var(--texto2)">Carregando...</p>';

  if (tipo === 'estoque') {
    titulo.textContent = '📦 Posição de Estoque';
    const produtos = await supa.get('produtos', 'select=*,categorias(nome)&order=nome.asc');
    conteudo.innerHTML = `<table class="tabela">
      <thead><tr><th>Código</th><th>Produto</th><th>Categoria</th><th>Unidade</th><th>Qtd. Atual</th><th>Estoque Mín.</th><th>Status</th></tr></thead>
      <tbody>${(produtos || []).map(p => {
        let badge = 'badge-ok'; let label = 'Normal';
        if (p.quantidade_atual === 0) { badge = 'badge-critico'; label = 'Zerado'; }
        else if (p.quantidade_atual <= p.estoque_minimo) { badge = 'badge-baixo'; label = 'Baixo'; }
        return `<tr><td>${p.codigo}</td><td>${p.nome}</td><td>${p.categorias?.nome || '—'}</td><td>${p.unidade}</td><td>${p.quantidade_atual}</td><td>${p.estoque_minimo}</td><td><span class="badge ${badge}">${label}</span></td></tr>`;
      }).join('')}</tbody>
    </table>`;

  } else if (tipo === 'entradas') {
    titulo.textContent = '↓ Relatório de Entradas';
    const movs = await supa.get('movimentacoes', 'select=*,produtos(nome,codigo,unidade)&tipo=eq.entrada&order=data_movimentacao.desc');
    conteudo.innerHTML = tabelaMovimentacoes(movs);

  } else if (tipo === 'saidas') {
    titulo.textContent = '↑ Relatório de Saídas';
    const movs = await supa.get('movimentacoes', 'select=*,produtos(nome,codigo,unidade)&tipo=eq.saida&order=data_movimentacao.desc');
    conteudo.innerHTML = tabelaMovimentacoes(movs);

  } else if (tipo === 'baixo') {
    titulo.textContent = '⚠ Produtos com Estoque Crítico';
    const produtos = await supa.get('produtos', 'select=*&order=quantidade_atual.asc');
    const baixo = (produtos || []).filter(p => p.quantidade_atual <= p.estoque_minimo);
    conteudo.innerHTML = `<table class="tabela">
      <thead><tr><th>Código</th><th>Produto</th><th>Qtd. Atual</th><th>Estoque Mín.</th><th>Diferença</th></tr></thead>
      <tbody>${baixo.map(p => `<tr>
        <td>${p.codigo}</td><td>${p.nome}</td>
        <td style="color:var(--vermelho);font-weight:600">${p.quantidade_atual} ${p.unidade}</td>
        <td>${p.estoque_minimo} ${p.unidade}</td>
        <td>${p.estoque_minimo - p.quantidade_atual} ${p.unidade}</td>
      </tr>`).join('')}</tbody>
    </table>`;
  }
}

function tabelaMovimentacoes(movs) {
  if (!movs || movs.length === 0) return '<p style="padding:1rem;color:var(--texto2)">Nenhum registro encontrado.</p>';
  return `<table class="tabela">
    <thead><tr><th>Data</th><th>Produto</th><th>Qtd.</th><th>Solicitante/Fornecedor</th><th>Departamento</th><th>Motivo</th></tr></thead>
    <tbody>${movs.map(m => `<tr>
      <td>${new Date(m.data_movimentacao).toLocaleString('pt-BR')}</td>
      <td>${m.produtos ? `${m.produtos.codigo} — ${m.produtos.nome}` : '—'}</td>
      <td>${m.quantidade} ${m.produtos?.unidade || ''}</td>
      <td>${m.solicitante || '—'}</td>
      <td>${m.departamento || '—'}</td>
      <td>${m.motivo || '—'}</td>
    </tr>`).join('')}</tbody>
  </table>`;
}

function imprimirRelatorio() {
  window.print();
}
