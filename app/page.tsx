"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, BarChart3, BookOpenCheck, Building2, CheckCircle2, ChevronRight, CircleDollarSign, Cloud, CloudOff, Download, FileText, FlaskConical, HelpCircle, LogOut, PackageOpen, Plus, Printer, Save, Scale, Trash2, Upload, UserCog, Users } from "lucide-react";
import { emptyBusiness, exportBusinesses, loadBusinesses, normalizeBusinesses, saveBusinesses } from "@/lib/storage";
import { ingredientCsvTemplate, ingredientNameKey, parseIngredientCsv, sortIngredientsAlphabetically } from "@/lib/ingredient-csv";
import { businessBreakEven, businessReadiness, ingredientBaseCost, localNarrativeReport, priceAnalysis, recipeCost, recipeItemCost, subproductBaseCost, subproductBatchCost } from "@/lib/pricing";
import { createReportPdf } from "@/lib/report-pdf";
import type { AllocationMode, Business, Competitor, Expense, Ingredient, MultiplierCostBasis, Product, RecipeItem, Subproduct, Unit } from "@/lib/types";

const money = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
const tabs = [
  ["guia", "Como usar", BookOpenCheck], ["negocio", "Negócio", Building2], ["insumos", "Insumos", PackageOpen],
  ["produtos", "Produtos e fichas", FlaskConical], ["despesas", "Despesas e rateio", CircleDollarSign],
  ["concorrentes", "Concorrentes", Users], ["precos", "Sugestão de preços", BarChart3], ["relatorio", "Relatório final", FileText],
  ["admin", "Administração", UserCog]
] as const;
type Tab = typeof tabs[number][0];
type SyncMode = "checking"|"local"|"cloud"|"unauthenticated"|"unavailable";

export default function App() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [tab, setTab] = useState<Tab>("guia");
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [syncMode, setSyncMode] = useState<SyncMode>("checking");
  const [syncMessage, setSyncMessage] = useState("Verificando armazenamento...");
  const [currentUser, setCurrentUser] = useState<{email:string;role:"admin"|"volunteer"}|null>(null);
  const [openaiConfigured, setOpenaiConfigured] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const revisionRef = useRef(0);
  const lastSyncedRef = useRef("");

  useEffect(() => {
    const initialize=async()=>{
      const local = loadBusinesses();
      setBusinesses(local); setSelectedId(local[0]?.id ?? "");
      try {
        const sessionResponse=await fetch("/api/auth/session",{cache:"no-store"}),session=await sessionResponse.json();
        if(session.mode==="local"){setSyncMode("local");setSyncMessage("Salvo neste navegador");setReady(true);return;}
        if(session.mode==="unavailable"||!sessionResponse.ok){setSyncMode("unavailable");setSyncMessage("Banco online indisponível");setReady(true);return;}
        if(!session.authenticated){setSyncMode("unauthenticated");setReady(true);return;}
        setCurrentUser(session.user);setOpenaiConfigured(!!session.openaiConfigured);
        const response=await fetch("/api/businesses",{cache:"no-store"});
        if(!response.ok) throw new Error();
        const cloud=await response.json(),cloudBusinesses=normalizeBusinesses(cloud.businesses??[]);
        revisionRef.current=cloud.revision??0;
        if(cloudBusinesses.length){setBusinesses(cloudBusinesses);setSelectedId(cloudBusinesses[0]?.id??"");lastSyncedRef.current=JSON.stringify(cloudBusinesses);}
        else if(local.length){
          const migrated=await fetch("/api/businesses",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({businesses:local,expectedRevision:0})});
          const result=await migrated.json(); if(!migrated.ok) throw new Error(); revisionRef.current=result.revision; lastSyncedRef.current=JSON.stringify(local);
        } else lastSyncedRef.current="[]";
        setSyncMode("cloud");setSyncMessage("Banco online sincronizado");
      } catch {setSyncMode("unavailable");setSyncMessage("Banco online indisponível");}
      finally {setReady(true);}
    };
    initialize();
  }, []);
  useEffect(() => {
    if (!ready) return;
    const localSaved=saveBusinesses(businesses); setSaveError(!localSaved);
    if(syncMode!=="cloud") return;
    const serialized=JSON.stringify(businesses);
    if(serialized===lastSyncedRef.current) return;
    setSyncMessage("Salvando no banco online...");
    const timer=setTimeout(async()=>{
      try {
        const response=await fetch("/api/businesses",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({businesses,expectedRevision:revisionRef.current})});
        const result=await response.json();
        if(!response.ok) throw new Error(result.conflict?"Conflito de edição. Atualize a página antes de continuar.":"Falha ao salvar online.");
        revisionRef.current=result.revision;lastSyncedRef.current=serialized;setSyncMessage("Banco online sincronizado");setSaveError(!localSaved);
      } catch(error){setSaveError(true);setSyncMessage(error instanceof Error?error.message:"Falha ao salvar online.");}
    },900);
    return()=>clearTimeout(timer);
  }, [businesses, ready, syncMode]);

  const business = businesses.find(item => item.id === selectedId);
  const isAdmin = currentUser?.role === "admin";
  const visibleTabs = tabs.filter(([key]) => key !== "admin" || isAdmin);
  const update = (changes: Partial<Business>) => setBusinesses(items => items.map(item => item.id === selectedId ? { ...item, ...changes, updatedAt: new Date().toISOString() } : item));
  const create = () => { const item = emptyBusiness(); item.name = `Novo negócio ${businesses.length + 1}`; setBusinesses([...businesses, item]); setSelectedId(item.id); setTab("negocio"); };
  const removeBusiness = () => {
    if (!business || !confirm(`Excluir "${business.name}" e todos os seus dados?`)) return;
    const next = businesses.filter(item => item.id !== business.id); setBusinesses(next); setSelectedId(next[0]?.id ?? "");
  };
  const download = () => {
    const url = URL.createObjectURL(exportBusinesses(businesses)); const a = document.createElement("a");
    a.href = url; a.download = "backup-vida-produtiva.json"; a.click(); URL.revokeObjectURL(url);
  };
  const importFile = (file?: File) => {
    if (!file) return; const reader = new FileReader();
    reader.onload = () => { try { const data = JSON.parse(String(reader.result)); if (!Array.isArray(data)) throw new Error(); if (businesses.length && !confirm("Importar este backup substituirá todos os negócios salvos neste computador. Continuar?")) return; const normalized=normalizeBusinesses(data); setBusinesses(normalized); setSelectedId(normalized[0]?.id ?? ""); alert("Backup importado com sucesso."); } catch { alert("O arquivo escolhido não é um backup válido."); } };
    reader.readAsText(file);
  };

  if (!ready) return <div className="loading">Preparando o sistema...</div>;
  if(syncMode==="unauthenticated") return <Login/>;
  if(syncMode==="unavailable") return <Unavailable/>;
  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><img src="/brand/vida-produtiva.png" alt="Projeto Vida Produtiva"/><small>custeio e precificação</small></div>
      <button className="new-business" onClick={create}><Plus size={16}/> Novo negócio</button>
      <label className="business-select">Negócio atendido<select value={selectedId} onChange={e => setSelectedId(e.target.value)}><option value="">Selecione...</option>{businesses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <nav>{visibleTabs.map(([key, label, Icon], index) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}><span>{index + 1}</span><Icon size={17}/><b>{label}</b></button>)}</nav>
      <div className="backup"><button onClick={download}><Download size={15}/> Exportar backup</button>{isAdmin&&<button onClick={() => fileRef.current?.click()}><Upload size={15}/> Importar backup</button>}{syncMode==="cloud"&&<button onClick={async()=>{await fetch("/api/auth/logout",{method:"POST"});location.reload();}}><LogOut size={15}/> Sair</button>}<input ref={fileRef} type="file" accept=".json" onChange={e => importFile(e.target.files?.[0])}/></div>
    </aside>
    <main>
      <header><div><span>{currentUser?.email} · {isAdmin?"administrador":"voluntário"}</span><strong>{business?.name || "Nenhum negócio selecionado"}</strong></div><div className={`save-state ${saveError?"error":""}`}>{syncMode==="cloud"?<Cloud size={15}/>:<Save size={15}/>}<span>{syncMessage} · OpenAI {openaiConfigured?"configurada":"não configurada"}</span>{saveError&&<b>Exporte um backup agora.</b>}</div></header>
      <section className="content">
        {tab === "guia" && <Guide onStart={() => business ? setTab("negocio") : create()} />}
        {!business && tab !== "guia" && tab !== "admin" && <Empty onCreate={create}/>}
        {business && tab === "negocio" && <BusinessForm business={business} update={update} remove={removeBusiness} canDelete={isAdmin}/>}
        {business && tab === "insumos" && <Ingredients business={business} update={update}/>}
        {business && tab === "produtos" && <Products business={business} update={update}/>}
        {business && tab === "despesas" && <Expenses business={business} update={update}/>}
        {business && tab === "concorrentes" && <Competitors business={business} update={update}/>}
        {business && tab === "precos" && <Prices business={business}/>}
        {business && tab === "relatorio" && <Report business={business} update={update}/>}
        {tab === "admin" && isAdmin && <AdminPanel/>}
      </section>
    </main>
  </div>;
}

function Login(){
  const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[message,setMessage]=useState(""),[sending,setSending]=useState(false);
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setSending(true);setMessage("");try{const response=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});const result=await response.json();if(!response.ok)throw new Error(result.error);location.reload();}catch(error){setMessage(error instanceof Error?error.message:"Não foi possível entrar.");setSending(false);}};
  return <main className="login-page"><form className="login-card" onSubmit={submit}><img src="/brand/vida-produtiva.png" alt="Projeto Vida Produtiva"/><div><span>Acesso protegido</span><h1>Entre no sistema</h1><p>Os atendimentos serão salvos no banco online do Vida Produtiva e também neste navegador.</p></div><Field label="E-mail"><input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></Field><Field label="Senha"><input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></Field>{message&&<p className="login-error">{message}</p>}<button className="primary" disabled={sending}>{sending?"Entrando...":"Entrar com segurança"}</button></form></main>;
}

function Unavailable(){
  return <main className="login-page"><section className="login-card"><CloudOff size={40}/><div><span>Proteção dos dados</span><h1>Banco online indisponível</h1><p>O sistema bloqueou o acesso para evitar alterações que não possam ser salvas com segurança. Verifique a conexão ou a configuração do Netlify e tente novamente.</p></div><button className="primary" onClick={()=>location.reload()}>Tentar novamente</button></section></main>;
}

function PageTitle({ step, title, text, action }: { step: string; title: string; text: string; action?: React.ReactNode }) {
  return <div className="page-title"><div><span>{step}</span><h1>{title}</h1><p>{text}</p></div>{action}</div>;
}
function Guide({ onStart }: { onStart: () => void }) {
  const steps = [
    ["Cadastre o negócio", "Registre nome, responsável e informações do atendimento."],
    ["Cadastre os insumos", "Informe preço, tamanho da embalagem e aproveitamento real."],
    ["Monte as fichas técnicas", "Cadastre subprodutos, produtos finais, porções e componentes usados."],
    ["Distribua as despesas", "Escolha um critério e estime as vendas do próximo mês."],
    ["Pesquise concorrentes", "Registre de zero a cinco referências por produto."],
    ["Revise a sugestão", "Analise custo, faixa de preço e relatório antes de orientar o negócio."]
  ];
  return <><PageTitle step="Bem-vindo" title="Um caminho simples para formar preços melhores" text="Siga as etapas em ordem. O sistema salva cada alteração automaticamente e permite voltar ao atendimento quando precisar." action={<button className="primary" onClick={onStart}>Começar atendimento <ChevronRight size={16}/></button>}/>
    <div className="guide-hero"><div><img className="hero-logo" src="/brand/vida-produtiva.png" alt="Projeto Vida Produtiva"/><p>Antes de começar</p><h2>Preço bom não nasce de adivinhação.</h2><span>Tenha em mãos notas de compra, receitas, despesas mensais e referências de concorrentes. Converse com o empreendedor sobre perdas, rendimento e expectativa de vendas.</span></div><Scale size={120}/></div>
    <InstitutionalBrands/>
    <div className="steps">{steps.map((item, i) => <article key={item[0]}><span>{i + 1}</span><div><h3>{item[0]}</h3><p>{item[1]}</p></div></article>)}</div>
    <div className="info"><HelpCircle size={20}/><div><strong>Como a faixa de preço é formada?</strong><p>O mínimo considera custos, taxas sobre a venda, 2 vezes a base escolhida e o menor concorrente. O máximo usa 3 vezes a base como referência. A sugestão combina margem desejada com concorrentes, dando mais peso às referências com melhor experiência.</p></div></div>
    <div className="info privacy"><Archive size={20}/><div><strong>Privacidade e segurança dos atendimentos</strong><p>Todos os voluntários autorizados acessam os mesmos negócios pelo banco online. Uma cópia adicional também fica neste navegador. Somente ao clicar em “Gerar relatório com IA”, um resumo sem nome do responsável, contato ou observações é enviado à OpenAI.</p></div></div></>;
}
function Empty({ onCreate }: { onCreate: () => void }) { return <div className="empty"><Building2 size={42}/><h2>Crie ou selecione um negócio</h2><p>As informações ficam separadas e sincronizadas no banco online para toda a equipe.</p><button className="primary" onClick={onCreate}><Plus size={16}/> Criar primeiro negócio</button></div> }

function BusinessForm({ business, update, remove, canDelete }: { business: Business; update: (x: Partial<Business>) => void; remove: () => void; canDelete: boolean }) {
  return <><PageTitle step="Etapa 1 de 7" title="Informações do negócio" text="Identifique o empreendimento e registre observações úteis para os próximos atendimentos."/>
    <div className="form-card grid-2">
      <Field label="Nome do negócio"><input value={business.name} onChange={e => update({ name: e.target.value })}/></Field>
      <Field label="Nome do responsável"><input value={business.owner} onChange={e => update({ owner: e.target.value })}/></Field>
      <Field label="Segmento"><input placeholder="Ex.: alimentação, beleza, artesanato" value={business.segment} onChange={e => update({ segment: e.target.value })}/></Field>
      <Field label="Contato"><input value={business.contact} onChange={e => update({ contact: e.target.value })}/></Field>
      <Field label="Margem líquida desejada sobre a venda (%)"><input type="number" min="0" max="70" value={business.desiredMargin} onChange={e => update({ desiredMargin: bounded(e.target.value,0,70) })}/></Field>
      <Field label="Taxas sobre a venda (%)"><input type="number" min="0" max="60" value={business.sellingFeesPercent} onChange={e => update({ sellingFeesPercent: bounded(e.target.value,0,60) })}/><small>Some impostos, cartão, aplicativos, comissões e outras taxas proporcionais à venda.</small></Field>
      <Field label="Base dos multiplicadores 2x e 3x"><select value={business.multiplierCostBasis} onChange={e=>update({multiplierCostBasis:e.target.value as MultiplierCostBasis})}><option value="direct">Custo direto da receita (recomendado para alimentação)</option><option value="total">Custo total com despesas rateadas (mais conservador)</option></select><small>O ponto de equilíbrio mensal usa a margem de contribuição do mix de vendas e todas as despesas indiretas.</small></Field>
      <Field label="Última alteração"><input disabled value={new Date(business.updatedAt).toLocaleString("pt-BR")}/></Field>
      <Field label="Observações do atendimento" wide><textarea rows={5} value={business.notes} onChange={e => update({ notes: e.target.value })}/></Field>
    </div>{canDelete&&<button className="danger-link" onClick={remove}><Trash2 size={15}/> Excluir este negócio</button>}</>;
}

function Ingredients({ business, update }: Props) {
  const importRef=useRef<HTMLInputElement>(null),[importMessage,setImportMessage]=useState("");
  const add = () => update({ ingredients: [...business.ingredients, { id: crypto.randomUUID(), name: "", category: "", packageQuantity: 1, packageUnit: "kg", packagePrice: 0, yieldPercent: 100, supplier: "" }] });
  const edit = (id: string, changes: Partial<Ingredient>) => update({ ingredients: business.ingredients.map(x => x.id === id ? { ...x, ...changes } : x) });
  const editName=(id:string,name:string)=>{const key=ingredientNameKey(name);if(key&&business.ingredients.some(item=>item.id!==id&&ingredientNameKey(item.name)===key)){setImportMessage(`O insumo “${name.trim()}” já está cadastrado. O nome duplicado não foi aceito.`);return;}edit(id,{name});};
  const del = (id: string) => { const item=business.ingredients.find(x=>x.id===id); if(!confirm(`Excluir o insumo "${item?.name||"sem nome"}"? Ele também será removido das fichas técnicas.`)) return; update({ ingredients: business.ingredients.filter(x => x.id !== id), subproducts:business.subproducts.map(p=>({...p,recipe:p.recipe.filter(r=>r.ingredientId!==id)})), products: business.products.map(p => ({ ...p, recipe: p.recipe.filter(r => r.ingredientId !== id) })) }); };
  const downloadTemplate=()=>{const url=URL.createObjectURL(ingredientCsvTemplate()),a=document.createElement("a");a.href=url;a.download="modelo-importacao-insumos.csv";a.click();URL.revokeObjectURL(url);};
  const importIngredients=(file?:File)=>{if(!file)return;const reader=new FileReader();reader.onload=()=>{const result=parseIngredientCsv(String(reader.result));const known=new Set(business.ingredients.map(item=>ingredientNameKey(item.name)).filter(Boolean)),added:Ingredient[]=[];let duplicates=0;result.ingredients.forEach(item=>{const key=ingredientNameKey(item.name);if(known.has(key)){duplicates++;return;}known.add(key);added.push(item);});if(added.length)update({ingredients:[...business.ingredients,...added]});setImportMessage(`${added.length} insumo(s) importado(s)${duplicates?`, ${duplicates} duplicado(s) ignorado(s)`:""}${result.errors.length?` e ${result.errors.length} linha(s) com erro`:""}.`);if(result.errors.length)alert(result.errors.slice(0,10).join("\n"));};reader.readAsText(file);};
  return <><PageTitle step="Etapa 2 de 7" title="Insumos e custos de compra" text="Cadastre a embalagem como ela é comprada. O aproveitamento desconta perdas, cascas e sobras." action={<button className="primary" onClick={add}><Plus size={16}/> Adicionar insumo</button>}/>
    <section className="ingredient-tools"><div><strong>Importação em massa</strong><span>Use o modelo CSV no Excel. Na coluna “unidade de medida”, informe g, kg, ml, l ou un.</span>{importMessage&&<em>{importMessage}</em>}</div><button className="secondary" onClick={downloadTemplate}><Download size={15}/> Baixar planilha modelo</button><button className="secondary" onClick={()=>importRef.current?.click()}><Upload size={15}/> Importar planilha preenchida</button><input className="hidden-input" ref={importRef} type="file" accept=".csv,text/csv" onChange={e=>{importIngredients(e.target.files?.[0]);e.currentTarget.value="";}}/></section>
    <div className="table-card"><table><thead><tr><th>Insumo</th><th>Categoria</th><th>Fornecedor</th><th>Embalagem</th><th>Unidade</th><th>Preço</th><th>Aproveit.</th><th>Custo base</th><th/></tr></thead><tbody>
      {business.ingredients.map(item => <tr key={item.id}><td><input value={item.name} onChange={e => editName(item.id,e.target.value)}/></td><td><input value={item.category} onChange={e => edit(item.id,{category:e.target.value})}/></td><td><input value={item.supplier} onChange={e => edit(item.id,{supplier:e.target.value})}/></td><td><input type="number" min="0" value={item.packageQuantity} onChange={e => edit(item.id,{packageQuantity:bounded(e.target.value)})}/></td><td><UnitSelect value={item.packageUnit} onChange={v => edit(item.id,{packageUnit:v})}/></td><td><input type="number" min="0" step=".01" value={item.packagePrice} onChange={e => edit(item.id,{packagePrice:bounded(e.target.value)})}/></td><td><div className="suffix"><input type="number" min="1" max="100" value={item.yieldPercent} onChange={e => edit(item.id,{yieldPercent:bounded(e.target.value,1,100)})}/><span>%</span></div></td><td><strong>{money(ingredientBaseCost(item))}/{baseLabel(item.packageUnit)}</strong></td><td><IconButton onClick={() => del(item.id)}/></td></tr>)}
      {!business.ingredients.length && <EmptyRow text="Nenhum insumo cadastrado. Use o botão acima para começar." cols={9}/>}
    </tbody></table></div><MeasurementReference/></>;
}

function MeasurementReference(){const groups=[
  ["Farinha de trigo",["1 xícara = 120 g","1/2 xícara = 60 g","1/3 xícara = 40 g","1/4 xícara = 30 g","1 colher (sopa) = 7,5 g"]],
  ["Manteiga ou margarina",["1 xícara = 200 g","1/2 xícara = 100 g","1/3 xícara = 65 g","1 colher (sopa) = 15 g"]],
  ["Açúcar",["1 xícara = 180 g","1/2 xícara = 90 g","1/3 xícara = 60 g","1/4 xícara = 45 g","1 colher (sopa) = 12 g"]],
  ["Líquidos",["1 xícara = 240 ml","1/2 xícara = 120 ml","1/3 xícara = 80 ml","1/4 xícara = 60 ml","1 colher (sopa) = 15 ml","1 colher (chá) = 5 ml"]],
  ["Chocolate ou cacau em pó",["1 xícara = 90 g","1/2 xícara = 45 g","1/3 xícara = 30 g","1/4 xícara = 20 g","1 colher (sopa) = 6 g"]]
];return <details className="measurement-reference"><summary>Tabela consultiva de medidas culinárias</summary><p>Use apenas como apoio durante o preenchimento. Estes valores não alteram automaticamente nenhum dado ou cálculo do sistema e podem variar conforme o ingrediente e a forma de medir.</p><div>{groups.map(([name,values])=><article key={name as string}><strong>{name}</strong>{(values as string[]).map(value=><span key={value}>{value}</span>)}</article>)}</div></details>}

function Products({ business, update }: Props) {
  const sortedIngredients=sortIngredientsAlphabetically(business.ingredients),sortedSubproducts=sortIngredientsAlphabetically(business.subproducts);
  const add = () => update({ products: [...business.products, { id: crypto.randomUUID(), name: "", category: "", portions: 1, projectedSales: 1, allocationPercent: 0, recipe: [] }] });
  const edit = (id: string, changes: Partial<Product>) => update({ products: business.products.map(x => x.id === id ? { ...x, ...changes } : x) });
  const del = (id: string) => { const item=business.products.find(x=>x.id===id); if(!confirm(`Excluir o produto "${item?.name||"sem nome"}", sua ficha técnica e pesquisas de concorrentes?`)) return; update({ products: business.products.filter(x => x.id !== id), competitors: business.competitors.filter(c => c.productId !== id) }); };
  const addItem = (product: Product) => edit(product.id, { recipe: [...product.recipe, { id: crypto.randomUUID(), ingredientId: "", quantity: 0, unit: "g" }] });
  const editItem = (product: Product, id: string, changes: Partial<RecipeItem>) => edit(product.id, { recipe: product.recipe.map(x => x.id === id ? { ...x, ...changes } : x) });
  const delItem = (product: Product, id: string) => edit(product.id, { recipe: product.recipe.filter(x => x.id !== id) });
  return <><PageTitle step="Etapa 3 de 7" title="Produtos e fichas técnicas" text="Cadastre primeiro os pré-preparos feitos em lote e depois os produtos finais. A quantidade de porções divide o custo total da receita." action={<button className="primary" onClick={add}><Plus size={16}/> Novo produto</button>}/>
    <Subproducts business={business} update={update}/>
    <div className="section-divider"><div><span>Produtos finais</span><strong>Itens vendidos ao cliente</strong></div></div>
    <div className="product-stack">{business.products.map(product => <article className="product-card" key={product.id}><div className="product-head"><input className="product-name" placeholder="Nome do produto" value={product.name} onChange={e => edit(product.id,{name:e.target.value})}/><label>Categoria<input value={product.category} onChange={e => edit(product.id,{category:e.target.value})}/></label><label>Porções da receita<input type="number" min="1" value={product.portions} onChange={e => edit(product.id,{portions:bounded(e.target.value,1)})}/></label><div className="cost-badge"><span>Custo direto por porção</span><strong>{money(recipeCost(product,business.ingredients,business.subproducts))}</strong></div><IconButton onClick={() => del(product.id)}/></div>
      <div className="recipe-title"><strong>Componentes da ficha técnica</strong><button onClick={() => addItem(product)}><Plus size={14}/> Adicionar ingrediente/subproduto</button></div>
      <table><thead><tr><th>Insumo ou subproduto</th><th>Quantidade usada</th><th>Unidade</th><th>Custo</th><th/></tr></thead><tbody>{product.recipe.map(row => {const ingredient=business.ingredients.find(x=>x.id===row.ingredientId),subproduct=business.subproducts.find(x=>x.id===row.subproductId),sourceUnit=ingredient?.packageUnit??subproduct?.yieldUnit;const value=row.subproductId?`subproduct:${row.subproductId}`:row.ingredientId?`ingredient:${row.ingredientId}`:"";return <tr key={row.id}><td><select value={value} onChange={e=>{const [kind,id]=e.target.value.split(":");const selectedIngredient=business.ingredients.find(x=>x.id===id),selectedSubproduct=business.subproducts.find(x=>x.id===id),unit=recipeUnit(selectedIngredient?.packageUnit??selectedSubproduct?.yieldUnit);editItem(product,row.id,{ingredientId:kind==="ingredient"?id:"",subproductId:kind==="subproduct"?id:undefined,unit});}}><option value="">Selecione...</option><optgroup label="Insumos">{sortedIngredients.map(x=><option key={x.id} value={`ingredient:${x.id}`}>{x.name||"Insumo sem nome"}</option>)}</optgroup><optgroup label="Subprodutos">{sortedSubproducts.map(x=><option key={x.id} value={`subproduct:${x.id}`}>{x.name||"Subproduto sem nome"}</option>)}</optgroup></select></td><td><input type="number" min="0" step=".01" value={row.quantity} onChange={e=>editItem(product,row.id,{quantity:bounded(e.target.value)})}/></td><td><UnitSelect value={row.unit} allowed={compatibleUnits(sourceUnit)} onChange={v=>editItem(product,row.id,{unit:v})}/></td><td><strong>{money(recipeItemCost(row,business.ingredients,business.subproducts))}</strong></td><td><IconButton onClick={()=>delItem(product,row.id)}/></td></tr>})}<EmptyRow when={!!product.recipe.length} text="Adicione os ingredientes e subprodutos usados nesta receita." cols={5}/></tbody></table>
    </article>)}{!business.products.length && <div className="empty small"><FlaskConical size={34}/><h2>Nenhum produto cadastrado</h2><p>Cadastre os insumos primeiro e depois monte as fichas técnicas.</p></div>}</div></>;
}

function Subproducts({business,update}:Props){
  const sortedIngredients=sortIngredientsAlphabetically(business.ingredients);
  const add=()=>update({subproducts:[...business.subproducts,{id:crypto.randomUUID(),name:"",category:"",yieldQuantity:1,yieldUnit:"un",recipe:[]}]});
  const edit=(id:string,changes:Partial<Subproduct>)=>update({subproducts:business.subproducts.map(item=>item.id===id?{...item,...changes}:item)});
  const del=(id:string)=>{const item=business.subproducts.find(x=>x.id===id);if(!confirm(`Excluir o subproduto "${item?.name||"sem nome"}"? Ele também será removido dos produtos finais.`))return;update({subproducts:business.subproducts.filter(x=>x.id!==id),products:business.products.map(product=>({...product,recipe:product.recipe.filter(row=>row.subproductId!==id)}))});};
  const addItem=(item:Subproduct)=>edit(item.id,{recipe:[...item.recipe,{id:crypto.randomUUID(),ingredientId:"",quantity:0,unit:"g"}]});
  const editItem=(item:Subproduct,id:string,changes:Partial<RecipeItem>)=>edit(item.id,{recipe:item.recipe.map(row=>row.id===id?{...row,...changes}:row)});
  return <section className="subproducts"><div className="section-divider"><div><span>Pré-preparos e subprodutos</span><strong>Massas, molhos, recheios e bases usados nos produtos finais</strong></div><button className="secondary" onClick={add}><Plus size={15}/> Novo subproduto</button></div><div className="product-stack">{business.subproducts.map(item=><article className="product-card subproduct-card" key={item.id}><div className="product-head"><input className="product-name" placeholder="Nome do subproduto" value={item.name} onChange={e=>edit(item.id,{name:e.target.value})}/><label>Categoria<input value={item.category} onChange={e=>edit(item.id,{category:e.target.value})}/></label><label>Rendimento do lote<div className="inline-fields"><input type="number" min="0.001" step=".01" value={item.yieldQuantity} onChange={e=>edit(item.id,{yieldQuantity:bounded(e.target.value)})}/><UnitSelect value={item.yieldUnit} onChange={value=>edit(item.id,{yieldUnit:value})}/></div></label><div className="cost-badge"><span>Custo do lote / custo base</span><strong>{money(subproductBatchCost(item,business.ingredients))} · {money(subproductBaseCost(item,business.ingredients))}/{baseLabel(item.yieldUnit)}</strong></div><IconButton onClick={()=>del(item.id)}/></div><div className="recipe-title"><strong>Insumos do subproduto</strong><button onClick={()=>addItem(item)}><Plus size={14}/> Adicionar insumo</button></div><table><thead><tr><th>Insumo</th><th>Quantidade usada</th><th>Unidade</th><th>Custo</th><th/></tr></thead><tbody>{item.recipe.map(row=>{const ingredient=business.ingredients.find(x=>x.id===row.ingredientId);return <tr key={row.id}><td><select value={row.ingredientId} onChange={e=>{const selected=business.ingredients.find(x=>x.id===e.target.value);editItem(item,row.id,{ingredientId:e.target.value,unit:recipeUnit(selected?.packageUnit)});}}><option value="">Selecione...</option>{sortedIngredients.map(x=><option key={x.id} value={x.id}>{x.name||"Insumo sem nome"}</option>)}</select></td><td><input type="number" min="0" step=".01" value={row.quantity} onChange={e=>editItem(item,row.id,{quantity:bounded(e.target.value)})}/></td><td><UnitSelect value={row.unit} allowed={compatibleUnits(ingredient?.packageUnit)} onChange={value=>editItem(item,row.id,{unit:value})}/></td><td><strong>{money(recipeItemCost(row,business.ingredients))}</strong></td><td><IconButton onClick={()=>edit(item.id,{recipe:item.recipe.filter(x=>x.id!==row.id)})}/></td></tr>})}<EmptyRow when={!!item.recipe.length} text="Adicione os insumos utilizados neste lote." cols={5}/></tbody></table></article>)}{!business.subproducts.length&&<div className="subproduct-empty">Subprodutos são opcionais. Cadastre um quando produzir uma base em lote para usar em um ou mais produtos finais.</div>}</div></section>;
}

function Expenses({ business, update }: Props) {
  const add = () => update({ expenses: [...business.expenses, { id: crypto.randomUUID(), name: "", value: 0, notes: "" }] });
  const edit = (id:string, changes:Partial<Expense>) => update({expenses:business.expenses.map(x=>x.id===id?{...x,...changes}:x)});
  const del = (id:string) => update({expenses:business.expenses.filter(x=>x.id!==id)});
  const editProduct=(id:string,changes:Partial<Product>)=>update({products:business.products.map(x=>x.id===id?{...x,...changes}:x)});
  const total=business.expenses.reduce((s,x)=>s+Math.max(x.value,0),0), allocation=business.products.reduce((s,x)=>s+Math.max(x.allocationPercent,0),0);
  return <><PageTitle step="Etapa 4 de 7" title="Despesas e rateio" text="Inclua aluguel, energia, pró-labore e outros gastos mensais. Depois escolha como dividir entre os produtos." action={<button className="primary" onClick={add}><Plus size={16}/> Adicionar despesa</button>}/>
    <div className="summary-row"><Summary label="Despesas mensais" value={money(total)}/><Summary label="Produtos para rateio" value={String(business.products.length)}/><Summary label="Pesos informados no rateio" value={`${allocation.toFixed(1)}`} alert={business.allocationMode==="manual"&&allocation<=0}/></div>
    <div className="split"><div className="table-card"><table><thead><tr><th>Despesa mensal</th><th>Valor</th><th>Observação</th><th/></tr></thead><tbody>{business.expenses.map(x=><tr key={x.id}><td><input value={x.name} onChange={e=>edit(x.id,{name:e.target.value})}/></td><td><input type="number" min="0" step=".01" value={x.value} onChange={e=>edit(x.id,{value:bounded(e.target.value)})}/></td><td><input value={x.notes} onChange={e=>edit(x.id,{notes:e.target.value})}/></td><td><IconButton onClick={()=>del(x.id)}/></td></tr>)}<EmptyRow when={!!business.expenses.length} text="Nenhuma despesa mensal cadastrada." cols={4}/></tbody></table></div>
    <div className="form-card"><Field label="Critério de rateio"><select value={business.allocationMode} onChange={e=>update({allocationMode:e.target.value as AllocationMode})}><option value="sales">Proporcional às vendas estimadas (recomendado)</option><option value="manual">Pesos definidos pelo usuário</option><option value="equal">Divisão igual entre produtos</option></select></Field><p className="hint">A despesa atribuída a cada produto é dividida pelas unidades estimadas. No rateio manual, os números funcionam como pesos relativos e o sistema normaliza automaticamente.</p>
    <table><thead><tr><th>Produto</th><th>Vendas estimadas</th>{business.allocationMode==="manual"&&<th>Peso do rateio</th>}</tr></thead><tbody>{business.products.map(p=><tr key={p.id}><td><strong>{p.name||"Produto sem nome"}</strong></td><td><input type="number" min="1" value={p.projectedSales} onChange={e=>editProduct(p.id,{projectedSales:bounded(e.target.value)})}/></td>{business.allocationMode==="manual"&&<td><div className="suffix"><input type="number" min="0" value={p.allocationPercent} onChange={e=>editProduct(p.id,{allocationPercent:bounded(e.target.value)})}/><span>peso</span></div></td>}</tr>)}</tbody></table></div></div></>;
}

function Competitors({ business, update }: Props) {
  const [selectedProductId,setSelectedProductId]=useState(business.products[0]?.id??"");
  useEffect(()=>{if(!business.products.some(product=>product.id===selectedProductId)) setSelectedProductId(business.products[0]?.id??"");},[business.products,selectedProductId]);
  const add = (productId:string) => {
    if(!productId) return;
    if(business.competitors.filter(c=>c.productId===productId).length>=5) return alert("O limite é de cinco concorrentes por produto.");
    update({competitors:[...business.competitors,{id:crypto.randomUUID(),productId,name:"",price:0,rating:3,researchedAt:new Date().toISOString().slice(0,10),notes:""}]});
  };
  const edit=(id:string,changes:Partial<Competitor>)=>update({competitors:business.competitors.map(x=>x.id===id?{...x,...changes}:x)});
  const del=(id:string)=>update({competitors:business.competitors.filter(x=>x.id!==id)});
  return <><PageTitle step="Etapa 5 de 7" title="Pesquisa de concorrentes" text="Use até cinco referências por produto. A nota de experiência ajuda a registrar diferenças de estrutura, atendimento e qualidade."/>
  {business.products.length?<section className="competitor-quick-add"><div><strong>Adicionar preço comparativo</strong><span>Escolha o produto e clique no botão para abrir uma nova linha de pesquisa.</span></div><select aria-label="Produto para preço comparativo" value={selectedProductId} onChange={e=>setSelectedProductId(e.target.value)}>{business.products.map(product=><option key={product.id} value={product.id}>{product.name||"Produto sem nome"}</option>)}</select><button className="primary" onClick={()=>add(selectedProductId)} disabled={!selectedProductId||business.competitors.filter(c=>c.productId===selectedProductId).length>=5}><Plus size={16}/> Adicionar preço comparativo</button></section>:<div className="empty small"><Users size={34}/><h2>Cadastre um produto primeiro</h2><p>Os preços dos concorrentes são vinculados aos produtos cadastrados na etapa Produtos e fichas.</p></div>}
  <div className="product-stack competitor-stack">{business.products.map(product=>{const rivals=business.competitors.filter(x=>x.productId===product.id);return <article className="product-card competitor-card" key={product.id}><div className="recipe-title"><div><strong>{product.name||"Produto sem nome"}</strong><span>{rivals.length} de 5 preços comparativos registrados</span></div><button onClick={()=>add(product.id)} disabled={rivals.length>=5}><Plus size={14}/> Adicionar preço</button></div><table><thead><tr><th>Concorrente</th><th>Preço semelhante</th><th>Experiência (1 a 5)</th><th>Data da pesquisa</th><th>Observações</th><th/></tr></thead><tbody>{rivals.map(x=><tr key={x.id}><td><input aria-label={`Nome do concorrente de ${product.name||"produto"}`} placeholder="Nome do concorrente" value={x.name} onChange={e=>edit(x.id,{name:e.target.value})}/></td><td><input aria-label={`Preço concorrente de ${product.name||"produto"}`} placeholder="R$ 0,00" type="number" min="0" step=".01" value={x.price||""} onChange={e=>edit(x.id,{price:bounded(e.target.value)})}/></td><td><select aria-label={`Experiência do concorrente de ${product.name||"produto"}`} value={x.rating} onChange={e=>edit(x.id,{rating:+e.target.value})}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n} - {["Muito fraca","Fraca","Regular","Boa","Excelente"][n-1]}</option>)}</select></td><td><input aria-label={`Data da pesquisa de ${product.name||"produto"}`} type="date" value={x.researchedAt} onChange={e=>edit(x.id,{researchedAt:e.target.value})}/></td><td><input aria-label={`Observações do concorrente de ${product.name||"produto"}`} placeholder="Qualidade, tamanho, atendimento..." value={x.notes} onChange={e=>edit(x.id,{notes:e.target.value})}/></td><td><IconButton onClick={()=>del(x.id)}/></td></tr>)}<EmptyRow when={!!rivals.length} text="Clique em “Adicionar preço” para registrar um concorrente." cols={6}/></tbody></table></article>})}</div></>;
}

function Prices({ business }: {business:Business}) {
  return <><PageTitle step="Etapa 6 de 7" title="Sugestão de preços" text="Use a faixa como apoio à decisão. Ela considera custos, taxas, margem desejada e referências de mercado."/>
    <ReadinessPanel business={business}/>
    <BreakEvenPanel business={business}/>
    <div className="price-list">{business.products.map(product=>{const a=priceAnalysis(product,business);return <article key={product.id}><div className="price-product"><span>{product.category||"Sem categoria"}</span><h2>{product.name||"Produto sem nome"}</h2><small>{a.rivals.length ? `${a.rivals.length} concorrente(s) considerado(s)` : "Preço baseado somente em custos"} · Base 2x/3x: {business.multiplierCostBasis==="direct"?"custo direto":"custo total"}</small></div><Price label="Custo total" value={a.cost} strong/><Price label="Preço sem prejuízo unitário" value={a.unitFloor}/><Price label="Preço pela margem" value={a.targetPrice}/><Price label="Preço mínimo" value={a.minimum}/><Price label="Preço sugerido" value={a.suggested} featured/><Price label="Preço máximo" value={a.maximum}/><div className="price-health"><b>Margem líquida estimada: {a.netMarginPercent.toFixed(1)}%</b><span>Margem de contribuição: {a.contributionMarginPercent.toFixed(1)}%</span>{a.warnings.map(w=><em key={w}>{w}</em>)}</div></article>})}{!business.products.length&&<div className="empty small"><BarChart3 size={34}/><h2>Cadastre produtos para calcular preços</h2></div>}</div></>;
}

function ReadinessPanel({business}:{business:Business}) {
  const readiness=businessReadiness(business);
  return <section className={`readiness ${readiness.ready?"ready":"pending"}`}><div className="readiness-title">{readiness.ready?<CheckCircle2 size={22}/>:<HelpCircle size={22}/>}<div><strong>{readiness.ready?"Análise pronta para revisão":"Complete os dados obrigatórios"}</strong><span>{readiness.ready?"Os cálculos principais podem ser usados no atendimento.":"Resolva as pendências antes de entregar o relatório."}</span></div></div>{readiness.blockers.length>0&&<div><b>Pendências</b>{readiness.blockers.map(item=><span key={item}>{item}</span>)}</div>}{readiness.warnings.length>0&&<div><b>Pontos de atenção</b>{readiness.warnings.map(item=><span key={item}>{item}</span>)}</div>}</section>;
}

function BreakEvenPanel({business}:{business:Business}) {
  const equilibrium=businessBreakEven(business);
  return <section className="break-even-panel"><div><span>Ponto de equilíbrio mensal do negócio</span><strong>{equilibrium.breakEvenRevenue==null?"Ainda não calculável":money(equilibrium.breakEvenRevenue)}</strong><p>Faturamento necessário para pagar custos diretos, taxas sobre vendas e todas as despesas indiretas, considerando o mix de vendas previsto.</p></div><Summary label="Faturamento previsto" value={money(equilibrium.projectedRevenue)}/><Summary label="Margem de contribuição do mix" value={`${(equilibrium.contributionMarginRatio*100).toFixed(1)}%`}/><Summary label="Margem de segurança" value={equilibrium.safetyMargin==null?"Não calculável":money(equilibrium.safetyMargin)} alert={equilibrium.safetyMargin!=null&&equilibrium.safetyMargin<0}/></section>;
}

function Report({business,update}:Props) {
  const total=business.expenses.reduce((s,x)=>s+x.value,0);
  const equilibrium=businessBreakEven(business);
  const readiness=businessReadiness(business);
  const [generating,setGenerating]=useState(false);
  const [generationMessage,setGenerationMessage]=useState("");
  const generate=async()=>{
    setGenerating(true); setGenerationMessage("");
    const products=business.products.map(product=>{const analysis=priceAnalysis(product,business);return {nome:product.name,categoria:product.category,vendasPrevistas:product.projectedSales,custoDireto:analysis.direct,custoIndireto:analysis.indirect,custoTotal:analysis.cost,precoMinimo:analysis.minimum,precoSugerido:analysis.suggested,precoMaximo:analysis.maximum,margemLiquidaPercentual:analysis.netMarginPercent,concorrentes:analysis.rivals.map(r=>({nome:r.name,preco:r.price,notaExperiencia:r.rating,dataPesquisa:r.researchedAt}))};});
    const summary={negocio:{nome:business.name,segmento:business.segment},parametros:{margemDesejadaPercentual:business.desiredMargin,taxasVendaPercentual:business.sellingFeesPercent},despesasMensais:equilibrium.fixedExpenses,pontoEquilibrio:{faturamentoPrevisto:equilibrium.projectedRevenue,pontoEquilibrioMensal:equilibrium.breakEvenRevenue,margemContribuicaoPercentual:equilibrium.contributionMarginRatio*100,margemSeguranca:equilibrium.safetyMargin},produtos:products};
    try {
      const response=await fetch("/api/generate-report",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(summary)});
      const data=await response.json();
      if(!response.ok||!data.text) throw new Error(data.error||"Falha ao gerar o relatório.");
      update({reportText:String(data.text).slice(0,2000),reportGeneratedAt:new Date().toISOString()});
      setGenerationMessage("Relatório gerado pela OpenAI com sucesso.");
    } catch {
      update({reportText:localNarrativeReport(business),reportGeneratedAt:new Date().toISOString()});
      setGenerationMessage("A OpenAI não estava disponível. Foi criado um relatório automático local com os mesmos dados.");
    } finally { setGenerating(false); }
  };
  const downloadPdf=()=>{
    const blob=createReportPdf(`Vida Produtiva - ${business.name||"Relatório de custeio"}`,business.reportText);
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url; a.download=`relatorio-${slug(business.name||"vida-produtiva")}.pdf`; a.click(); URL.revokeObjectURL(url);
  };
  return <div className="report"><PageTitle step="Etapa 7 de 7" title="Relatório do atendimento" text="Revise as informações, gere a análise escrita e baixe o PDF para entregar ao empreendedor." action={<button className="primary no-print" onClick={()=>window.print()}><Printer size={16}/> Imprimir relatório completo</button>}/>
    <section className="report-cover"><div className="report-logo"><img src="/brand/vida-produtiva.png" alt="Projeto Vida Produtiva"/></div><span>Relatório de custeio e precificação</span><h1>{business.name}</h1><p>{business.segment} · Responsável: {business.owner||"não informado"}</p><small>Atualizado em {new Date(business.updatedAt).toLocaleDateString("pt-BR")}</small></section>
    <div className="report-summary"><Summary label="Despesas mensais" value={money(total)}/><Summary label="Faturamento previsto" value={money(equilibrium.projectedRevenue)}/><Summary label="Ponto de equilíbrio mensal" value={equilibrium.breakEvenRevenue==null?"Não calculável":money(equilibrium.breakEvenRevenue)}/></div>
    <ReadinessPanel business={business}/>
    <section className="ai-report"><div className="ai-report-head"><div><span>Relatório escrito</span><h2>Análise de custeio e precificação</h2><p>Gera um texto simples de até 2.000 caracteres usando os cálculos realizados. Ao clicar, um resumo sem responsável, contato ou observações é enviado à OpenAI. Revise o conteúdo antes da entrega.</p></div><button className="primary no-print" onClick={generate} disabled={generating||!readiness.ready} title={!readiness.ready?"Resolva as pendências obrigatórias antes de gerar.":""}>{generating?"Gerando...":"Gerar relatório com IA"}</button></div><textarea aria-label="Relatório escrito" maxLength={2000} rows={15} placeholder="Clique em “Gerar relatório com IA” após preencher todas as etapas." value={business.reportText} onChange={e=>update({reportText:e.target.value})}/><div className="ai-report-actions"><span>{business.reportText.length}/2.000 caracteres{business.reportGeneratedAt?` · Gerado em ${new Date(business.reportGeneratedAt).toLocaleString("pt-BR")}`:""}</span><div>{generationMessage&&<em>{generationMessage}</em>}<button className="secondary no-print" disabled={!business.reportText} onClick={downloadPdf}><Download size={15}/> Baixar relatório escrito em PDF</button></div></div></section>
    <section className="report-section"><h2>Preços recomendados</h2><table><thead><tr><th>Produto</th><th>Custo direto</th><th>Custo indireto</th><th>Custo total</th><th>Faixa sugerida</th><th>Preço sugerido</th><th>Margem líquida</th></tr></thead><tbody>{business.products.map(p=>{const a=priceAnalysis(p,business);return <tr key={p.id}><td><strong>{p.name}</strong></td><td>{money(a.direct)}</td><td>{money(a.indirect)}</td><td>{money(a.cost)}</td><td>{money(a.minimum)} a {money(a.maximum)}</td><td><strong>{money(a.suggested)}</strong></td><td>{a.netMarginPercent.toFixed(1)}%</td></tr>})}</tbody></table></section>
    <section className="report-section"><h2>Observações do atendimento</h2><p>{business.notes||"Nenhuma observação registrada."}</p></section>
    <InstitutionalBrands compact/><footer className="report-footer">Este relatório é uma ferramenta de apoio. A decisão final deve considerar capacidade produtiva, público, qualidade e estratégia do negócio.</footer></div>;
}

function AdminPanel(){
  type User={id:string;email:string;role:"admin"|"volunteer";created_at:string};
  const [users,setUsers]=useState<User[]>([]),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[message,setMessage]=useState(""),[testing,setTesting]=useState(false);
  const load=async()=>{const response=await fetch("/api/users",{cache:"no-store"});const data=await response.json();if(response.ok)setUsers(data.users??[]);else setMessage(data.error);};
  useEffect(()=>{load();},[]);
  const createUser=async(e:React.FormEvent)=>{e.preventDefault();setMessage("");const response=await fetch("/api/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});const data=await response.json();if(!response.ok)return setMessage(data.error);setEmail("");setPassword("");setMessage("Usuário voluntário criado com sucesso.");load();};
  const testOpenAI=async()=>{setTesting(true);setMessage("");const response=await fetch("/api/system/status",{method:"POST"});const data=await response.json();setMessage(data.connected?`OpenAI conectada corretamente ao modelo ${data.model}.`:`Falha na conexão com a OpenAI: ${data.error}`);setTesting(false);};
  return <><PageTitle step="Acesso exclusivo" title="Administração do sistema" text="Crie os acessos dos voluntários e verifique os serviços externos. Somente o administrador consegue acessar esta tela e excluir negócios."/>
    <div className="admin-grid"><form className="form-card" onSubmit={createUser}><h2>Criar usuário voluntário</h2><p className="hint">O voluntário poderá visualizar, criar e editar todos os negócios, mas não poderá excluí-los nem criar outros usuários.</p><Field label="E-mail"><input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></Field><Field label="Senha inicial (mínimo de 10 caracteres)"><input type="password" minLength={10} required value={password} onChange={e=>setPassword(e.target.value)}/></Field><button className="primary">Criar usuário</button></form>
    <section className="form-card"><h2>Serviços conectados</h2><div className="service-status"><Cloud size={20}/><div><strong>Banco online Netlify Database</strong><span>Conectado e compartilhado entre todos os usuários.</span></div></div><button className="secondary" onClick={testOpenAI} disabled={testing}>{testing?"Verificando...":"Testar conexão com a OpenAI"}</button>{message&&<p className="admin-message">{message}</p>}</section></div>
    <section className="table-card admin-users"><table><thead><tr><th>Usuário</th><th>Perfil</th><th>Criado em</th></tr></thead><tbody>{users.map(user=><tr key={user.id}><td><strong>{user.email}</strong></td><td>{user.role==="admin"?"Administrador":"Voluntário"}</td><td>{new Date(user.created_at).toLocaleString("pt-BR")}</td></tr>)}</tbody></table></section></>;
}

type Props={business:Business;update:(x:Partial<Business>)=>void};
function InstitutionalBrands({compact=false}:{compact?:boolean}){return <section className={`institutional ${compact?"compact":""}`}><div><span>Uma iniciativa do</span><img src="/brand/vida-produtiva.png" alt="Projeto Vida Produtiva"/></div><div><span>Com a parceria da</span><img src="/brand/comunhao-espirita.jpg" alt="Comunhão Espírita de Brasília"/></div><div><span>Vinculado à</span><img src="/brand/diretoria-promocao-social.jpg" alt="Diretoria de Promoção Social"/></div></section>}
function Field({label,children,wide=false}:{label:string;children:React.ReactNode;wide?:boolean}){return <label className={wide?"wide":""}><span>{label}</span>{children}</label>}
function IconButton({onClick}:{onClick:()=>void}){return <button className="icon-button" title="Excluir" onClick={onClick}><Trash2 size={15}/></button>}
function UnitSelect({value,onChange,allowed=["g","kg","ml","l","un"]}:{value:Unit;onChange:(x:Unit)=>void;allowed?:Unit[]}){return <select value={value} onChange={e=>onChange(e.target.value as Unit)}>{allowed.map(x=><option key={x}>{x}</option>)}</select>}
function EmptyRow({text,cols,when=false}:{text:string;cols:number;when?:boolean}){return when?null:<tr><td className="empty-row" colSpan={cols}>{text}</td></tr>}
function Summary({label,value,alert=false}:{label:string;value:string;alert?:boolean}){return <article className={`summary ${alert?"alert":""}`}><span>{label}</span><strong>{value}</strong></article>}
function Price({label,value,strong=false,featured=false}:{label:string;value:number;strong?:boolean;featured?:boolean}){return <div className={`price ${strong?"strong":""} ${featured?"featured":""}`}><span>{label}</span><b>{money(value)}</b></div>}
const baseLabel=(u:Unit)=>u==="kg"?"g":u==="l"?"ml":u;
const recipeUnit=(u?:Unit):Unit=>u==="kg"?"g":u==="l"?"ml":u??"g";
const compatibleUnits=(u?:Unit):Unit[]=>!u?["g","kg","ml","l","un"]:u==="kg"||u==="g"?["g","kg"]:u==="l"||u==="ml"?["ml","l"]:["un"];
const slug=(text:string)=>text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const bounded=(value:string,min=0,max=Number.POSITIVE_INFINITY)=>Math.min(Math.max(Number.isFinite(+value)?+value:min,min),max);
