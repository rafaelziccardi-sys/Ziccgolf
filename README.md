# ⛳ Golf Club — placar do grupo

Site privado para registrar rodadas de golfe e gerar rankings, estatísticas e
históricos ao longo do ano. Stroke Play + Match Play individual + Match Play de duplas.

Não precisa de Node nem build: é um site estático que conversa direto com o
**Supabase** (banco + login na nuvem, plano grátis).

---

## Ver uma demonstração (sem configurar nada)

Quer só dar uma olhada no site funcionando, com dados de exemplo?

1. Abra o **PowerShell** na pasta do projeto e rode o servidor local:
   ```powershell
   powershell -ExecutionPolicy Bypass -File "golf-club\serve.ps1"
   ```
2. No navegador, abra **http://localhost:5599** e clique em **🔎 Ver demonstração**
   (ou abra direto **http://localhost:5599/?demo=1**).

Você navega por rankings, perfis, estatísticas e até testa o export pra Excel.
No modo demo nada é salvo — para sair, clique em *“Sair do demo”* na faixa dourada.

---

## 1. Criar o banco (Supabase) — ~5 min

1. Crie uma conta grátis em https://supabase.com e clique em **New project**.
   Guarde a senha do banco (não vamos usá-la no site, mas o Supabase pede).
2. Aberto o projeto, vá em **SQL Editor** → **New query**.
3. Cole **todo** o conteúdo de [`schema.sql`](schema.sql) e clique em **Run**.
   Isso cria as tabelas (jogadores, rodadas, scores, confrontos) e a segurança.
4. Vá em **Project Settings → API** e copie dois valores:
   - **Project URL**
   - **anon public** key

## 2. Configurar o site

Abra [`js/config.js`](js/config.js) e cole os dois valores:

```js
export const SUPABASE_URL  = "https://xxxx.supabase.co";
export const SUPABASE_ANON = "eyJhbGciOi...";   // a anon public key
```

(Opcional) ajuste o nome do grupo em `APP_NOME` e as regras de pontos em `PONTOS`.

## 3. Criar o login do grupo

Por padrão o Supabase pode exigir confirmação de e-mail. Para um grupo de amigos,
o mais simples é desligar isso:

- **Authentication → Providers → Email** → desligue *“Confirm email”* → Save.

Depois, abra o site, clique em **Criar conta** e crie 1 login (pode ser um único
e-mail/senha compartilhado pelo grupo, ou um por pessoa — todos veem os mesmos dados).

## 4. Publicar na internet (escolha uma)

**Opção A — Netlify (arrastar e soltar, sem conta git):**
1. Acesse https://app.netlify.com/drop
2. Arraste a pasta `golf-club` inteira para a página. Pronto, sai um link público.
   (Para atualizar depois, arraste de novo.)

**Opção B — Vercel:**
1. Suba a pasta para um repositório no GitHub.
2. Em https://vercel.com → **Add New → Project** → importe o repo → Deploy.
   Sem framework, sem build command (é estático).

**Opção C — GitHub Pages:** suba a pasta num repo e ative Pages na branch `main`.

> Teste local: como são módulos ES, abra com um servidor simples (ex.: a extensão
> *Live Server* do VS Code). Abrir o `index.html` direto com `file://` pode bloquear
> os imports.

---

## Como usar

1. **Jogadores** → cadastre o pessoal (nome; foto e handicap são opcionais).
2. **+ Rodada** → data, marque quem jogou, digite os scores, registre os Match Plays
   (individuais e de duplas) e salve. Putts/fairways/GIR são opcionais.
3. **Início / Rankings / Estatísticas** atualizam sozinhos.
4. Dá para **editar** ou **excluir** qualquer rodada em *Rodadas*.

---

## Pontuação (resumo)

| Competição | Pontos |
|---|---|
| Stroke Play | 1º=10, 2º=7, 3º=5, 4º=3, demais=1 (colocação **entre os presentes no dia**) |
| Match individual | vitória 3 · empate 1 · derrota 0 |
| Match duplas | vitória 2 · empate 1 · derrota 0 (cada jogador) |

**Dois rankings:**
- **Oficial = média de pontos/rodada** (quem joga mais não leva vantagem injusta).
  Exige um mínimo de rodadas para qualificar (30% das rodadas do ano, mín. 3).
- **Total de pontos** (reconhece os mais assíduos).

Ajuste tudo em `js/config.js`.

---

## Estrutura do projeto

```
golf-club/
├─ index.html          shell do app
├─ styles.css          visual (verde/branco/cinza/preto, mobile-first)
├─ schema.sql          banco Supabase (já preparado p/ buraco-a-buraco + Strokes Gained)
├─ js/
│  ├─ config.js        ← VOCÊ configura aqui
│  ├─ supabase.js      cliente
│  ├─ auth.js          login do grupo
│  ├─ db.js            queries (carregar/salvar rodadas, jogadores)
│  ├─ scoring.js       motor de pontos e rankings (funções puras)
│  ├─ ui.js            helpers de interface
│  ├─ app.js           login gate + roteador
│  └─ pages/           home, rankings, novaRodada, rodadas, jogadores, jogador, stats
```

---

## Roadmap v2 (já preparado no banco)

- Preenchimento **buraco a buraco** (tabela `hole_scores` já existe).
- **Strokes Gained** (total, tee, approach, around the green, putting).
- Pars/birdies/bogeys, gráficos avançados de putts e evolução por buraco.

O MVP grava as estatísticas agregadas por rodada; quando ligar o modo detalhado,
elas passam a ser calculadas a partir de `hole_scores` sem refazer nada.
