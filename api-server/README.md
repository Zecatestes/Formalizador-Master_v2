# API de consulta de placas ODEEN

Este serviço é necessário para a consulta online do KePlaca e Dados da Placa. A interface web não consulta esses sites diretamente, pois o navegador pode bloquear requisições cross-origin.

## Requisitos
- Node.js 20+
- Python 3

## Instalação e execução

```bash
npm install
python -m pip install -r requirements.txt
npm start
```

A API fica disponível na porta `3001` por padrão. Teste a saúde em `/api/health`; a consulta é `POST /api/scrape`.

Variáveis opcionais:
- `PORT`: porta HTTP (padrão `3001`)
- `PYTHON_EXECUTABLE`: caminho do executável Python (`python3` no Linux/macOS e `python` no Windows por padrão)
- `ALLOWED_ORIGIN`: origens web permitidas, separadas por vírgula. Se omitida, CORS fica aberto; configure-a em produção.

A validação de URL e bloqueio de endereços privados são realizados no `scraper.py`. Mesmo assim, publique este serviço apenas em uma plataforma confiável e mantenha as dependências atualizadas.
