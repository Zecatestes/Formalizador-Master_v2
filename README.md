# Gerador de Relatórios Odeen

Aplicação web da Odeen & Co. para gerar relatórios de recuperação de veículos, formalizações operacionais e alertas de roubo/furto.

## Funcionalidades

- **Novo relatório:** preenchimento dos dados de recuperação e geração de PDF.
- **Formalizador Faster:** gerador de formalizações e modelos operacionais.
- **Consulta/Gerador de Alerta R/F:** consulta de placa no KePlaca ou Dados da Placa, exibição dos dados retornados, exportação do resultado em CSV e preenchimento assistido do alerta de roubo/furto.

## Executar a aplicação web

Requer Node.js 20.19+ ou 22.12+.

```bash
npm install
npm run dev
```

Abra o endereço indicado pelo Vite, normalmente `http://localhost:5173`.

## Ativar a consulta de placas

A consulta precisa de um pequeno serviço de backend porque o navegador não consegue consultar esses sites externos diretamente em todos os ambientes. O código do serviço está na pasta `api-server/`.

### 1. Instalar dependências do backend

É necessário ter Node.js e Python 3 instalados. Na pasta raiz do projeto, abra outro terminal e execute:

```bash
cd api-server
npm install
python -m pip install -r requirements.txt
npm start
```

No Windows, caso `python` não funcione, use `py -m pip install -r requirements.txt`. Se o servidor não localizar o Python, configure a variável de ambiente `PYTHON_EXECUTABLE`.

### 2. Configurar a aplicação

Para desenvolvimento local, a aplicação usa por padrão `/api/scrape`, e o Vite encaminha esse caminho para `http://localhost:3001`. Mantenha o backend em execução na porta 3001.

Se a API for hospedada separadamente, crie uma variável de ambiente de build chamada `VITE_SCRAPER_API_URL` com a URL completa do endpoint, por exemplo:

```text
https://SEU-SERVICO.example/api/scrape
```

Substitua o exemplo pela URL real do serviço publicado. No GitHub, cadastre essa URL em **Settings → Secrets and variables → Actions → Variables** com o nome `VITE_SCRAPER_API_URL`; o workflow já passa essa variável para o build. O backend aceita configurar `ALLOWED_ORIGIN` para limitar quais origens web podem chamá-lo.

**Importante sobre o GitHub Pages:** o GitHub Pages hospeda somente os arquivos estáticos da interface; ele não executa Node.js ou Python. Para que a consulta de placas funcione no site publicado, publique também a pasta `api-server/` em um serviço que execute Node.js e Python e configure `VITE_SCRAPER_API_URL` antes de gerar/publicar o frontend. Sem o backend ativo, as outras áreas continuam disponíveis, mas a consulta online não funcionará.

## Gerar versão de produção

```bash
npm run build
npm run preview
```

Os arquivos estáticos serão gerados em `dist/`.

## Publicar no GitHub

1. Crie um repositório no GitHub.
2. Envie todo o conteúdo da pasta do projeto, incluindo `src/`, `public/`, `api-server/` e os arquivos de configuração.
3. Faça o commit na branch `main`.
4. O workflow de GitHub Pages executa o build do frontend.
5. Para consulta de placas no site publicado, configure `VITE_SCRAPER_API_URL` no ambiente de build e publique o backend separadamente conforme explicado acima.

## Estrutura relevante

```text
.
├── api-server/
│   ├── server.mjs
│   ├── scraper.py
│   ├── package.json
│   └── requirements.txt
├── public/
│   └── formalizador-faster.html
├── src/
│   ├── components/
│   │   ├── consulta-alerta-panel.tsx
│   │   ├── alert-generator.tsx
│   │   └── formalizador-panel.tsx
│   └── lib/
│       └── vehicle-integration.ts
├── .env.example
├── package.json
└── vite.config.ts
```

A nova funcionalidade foi adicionada em componentes próprios. O gerador de relatórios e o Formalizador Faster permanecem separados e acessíveis pelo menu lateral.
