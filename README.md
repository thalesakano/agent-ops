# Agent Ops

Painel de operações de agentes por Thales Sakano, com Next.js, React, TypeScript e Tailwind.

- **`/` — demonstração pública:** tarefas, aprovações, relatórios e métricas simulados. Sem credenciais e sem execução externa.
- **`/live` — monitoramento privado:** consultas reais ao OpenClaw Gateway e ao dashboard Hermes, protegidas por login do operador.

O portfólio Sakano Lab continua usando a demonstração. Esta instalação independente contém os conectores reais.

## Executar

Node.js 22 ou superior:

```sh
npm ci
npm run dev
```

Abra http://localhost:3000. A demonstração funciona sem configuração. Para produção, use `npm run build` e `npm start` em um servidor Node com HTTPS no proxy reverso. O modo Live exige backend Node; não funciona como exportação estática.

## Modo Live

1. Copie `.env.example` para `.env.local`.
2. Defina `AGENT_OPS_PASSWORD` (mínimo 16 caracteres) e `AGENT_OPS_SESSION_SECRET` (mínimo 32). Use valores aleatórios diferentes. Para gerar cada um:

   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. Defina `AGENT_OPS_ORIGIN` como a **origem exata usada no navegador**: por exemplo `http://localhost:3000` no desenvolvimento, ou `https://agents.example.com` em produção. `localhost` e `127.0.0.1` são origens diferentes. Ajuste também a porta.
4. Configure um ou ambos os provedores abaixo. Reinicie o servidor após editar o ambiente.
5. Abra `/live`, entre com a senha do Agent Ops, selecione o provedor e clique em **Consultar agora**.

O login expira em oito horas. Cookies são HTTP-only e SameSite Strict, com Secure em HTTPS. As APIs de dados validam a sessão em todas as chamadas e retornam `Cache-Control: no-store`. Trocar a senha ou a chave de sessão invalida os logins existentes. Sem segredos válidos, o acesso fica desabilitado.

As credenciais dos provedores ficam no backend. Não coloque valores reais em código, URLs, variáveis `NEXT_PUBLIC_`, commits ou na demonstração do portfólio. `.env.local` e `.data/` são ignorados pelo Git.

### OpenClaw

```dotenv
OPENCLAW_GATEWAY_URL=wss://your-gateway.example.com/
OPENCLAW_TOKEN=
OPENCLAW_DEVICE_FILE=.data/openclaw-device.json
```

Preencha `OPENCLAW_TOKEN` com a credencial do gateway. Para gateways configurados com senha, use `OPENCLAW_PASSWORD` e deixe `OPENCLAW_TOKEN` vazio. Exatamente uma das duas deve estar configurada.

O conector recebe `connect.challenge`, assina o nonce e o timestamp com Ed25519 e solicita **apenas `operator.read`**. Negocia protocolo 3 ou 4. Depois de autenticar, consulta `agents.list` e `sessions.list` (até 100 sessões). A credencial e qualquer device token retornado pelo gateway não são enviados ao navegador.

Na primeira consulta, a identidade é criada em `OPENCLAW_DEVICE_FILE`. Se o gateway exigir pareamento:

1. Consulte no Agent Ops para gerar a solicitação. A interface mostra o ID do dispositivo.
2. No ambiente administrativo do seu OpenClaw, execute `openclaw devices list` e confira o dispositivo/solicitação pendente correspondente.
3. Aprove a solicitação correta com `openclaw devices approve <requestId>` e consulte novamente no Agent Ops. O dispositivo precisa ter o escopo `operator.read` autorizado.

Não desative autenticação ou pareamento para conectar. O conector roda no **servidor**, e não no navegador: não exige liberar CORS nem adicionar a origem do Agent Ops à lista do Control UI para este cliente. O proxy deve aceitar upgrade WebSocket, e a política do gateway ainda precisa permitir a identidade e a credencial.

Persista a identidade entre deploys. Em containers, monte um volume privado e configure o caminho absoluto. Em Windows, limite as permissões NTFS ao usuário do serviço; `mode: 0600` é aplicado onde suportado. Não exclua o arquivo para resolver erros de conexão: isso cria um novo dispositivo e exige novo pareamento. Gateways sem credencial compartilhada, com autenticação somente por trusted proxy, não são suportados por este conector.

A atividade de uma sessão não é inferida pelo horário da última atualização; aparece como “Não informada” quando não há um campo de atividade utilizado pelo conector.

### Hermes

Use a URL do **dashboard web do Hermes**, e não uma API de modelos ou um endpoint de mensagens. O conector consulta `/api/sessions?limit=100` e `/api/status`. O status público sozinho não é considerado prova de autenticação: a consulta de sessões precisa ser aceita.

**Provider de senha**, habilitado na instalação Hermes:

```dotenv
HERMES_DASHBOARD_URL=https://hermes.example.com/
HERMES_AUTH_MODE=password
HERMES_AUTH_PROVIDER=basic
HERMES_USERNAME=
HERMES_PASSWORD=
```

Use o nome do provider configurado na sua instalação; `basic` é apenas um exemplo. O backend faz POST em `/auth/password-login`, reutiliza a sessão, preserva cookies renovados e tenta um novo login se a consulta de sessões retornar 401/403. Não inventa um token Bearer para APIs que exigem cookies. Conforme a documentação Hermes, o provider de senha se destina a rede privada/VPN; use OAuth para exposição pública.

**Sessão existente de um provider OAuth**, configuração avançada:

```dotenv
HERMES_AUTH_MODE=cookie
HERMES_SESSION_COOKIE=
```

Forneça o valor do cabeçalho de requisição `Cookie` de uma **sessão dedicada ao Agent Ops**, incluindo os cookies de sessão/provider emitidos pelo Hermes. Não use o cabeçalho `Set-Cookie` nem atributos como `Path`/`HttpOnly`. Não compartilhe essa sessão com um navegador ativo: tokens de refresh podem ser rotacionados. O jar atualizado fica apenas na memória de uma instância do Agent Ops; renove a configuração após reiniciar o processo ou quando a sessão for revogada/expirar. Para uso contínuo em rede privada, prefira o provider de senha. Não há fluxo OAuth interativo próprio nesta versão.

**Dashboard local sem gate de autenticação:**

```dotenv
HERMES_DASHBOARD_URL=http://127.0.0.1:8642/
HERMES_AUTH_MODE=local
```

Use a porta real do seu dashboard. O modo `local` só permite loopback. Endereços remotos exigem HTTPS; redirects são recusados para evitar encaminhar credenciais para outra origem. Prefixos de caminho na URL do dashboard são preservados.

O Hermes retorna sessões do perfil padrão, modelo, tokens e atividade quando disponíveis. Não há um catálogo de agentes equivalente ao OpenClaw; o painel informa essa diferença. São chamadas de consulta: não enviamos comandos de execução/manutenção. O próprio Hermes pode executar manutenção automática de sessões durante seus endpoints GET, conforme sua configuração.

### Escopo e operação

| Recurso                                     | OpenClaw                         | Hermes                       |
| ------------------------------------------- | -------------------------------- | ---------------------------- |
| Conexão autenticada                         | WebSocket + desafio + identidade | API do dashboard + sessão    |
| Status/versão                               | Handshake do gateway             | `/api/status`                |
| Agentes configurados                        | Sim                              | Não disponível neste adapter |
| Sessões, modelo e tokens                    | Até 100                          | Até 100, perfil padrão       |
| Executar, cancelar ou aprovar tarefas reais | Não                              | Não                          |
| Histórico de mensagens e logs               | Não                              | Não                          |

Os controles de execução e aprovação da página inicial continuam sendo simulações. O modo Live atualiza sob demanda, sem polling automático, e mostra o horário da última consulta.

A instalação é para um operador ou equipe de confiança, com uma senha compartilhada e uma conexão por provedor. Use uma instância persistente. O limite de login é de dez tentativas por minuto por processo; adicione limites no proxy se expuser o serviço, especialmente com réplicas. Sessões Hermes em cookie mode não devem ser compartilhadas entre réplicas. A aplicação não fornece RBAC, auditoria de usuários nem gestão multi-tenant.

## Diagnóstico

- **Origem inválida:** ajuste `AGENT_OPS_ORIGIN` para a URL/porta exata do navegador e reinicie.
- **Pareamento pendente:** aprove a solicitação correta no gateway; mantenha o arquivo de identidade.
- **Solicitação recusada:** revise token/senha, versão e escopo `operator.read`.
- **Falha WebSocket:** confira DNS/TLS e suporte a upgrade no proxy reverso.
- **Hermes 401/403:** revise o provider/credenciais ou renove a sessão dedicada.
- **Hermes redirect/HTML/resposta incompatível:** confirme que a URL aponta para o dashboard e que a versão instalada oferece os endpoints documentados.

O probe opcional verifica apenas o transporte, sem autenticação:

```powershell
$env:OPENCLAW_GATEWAY_URL = 'wss://your-gateway.example.com/'
npm run probe:openclaw
```

## Verificação

```sh
npm test
npm run lint
npm run build
npm run test:live-browser
npm audit
```

O teste Live inicia um servidor Next e provedores locais de teste, sem usar credenciais externas. Exercita login/logout, autenticação recusada, pareamento, listagens, filtro e mobile. Testes de protocolo verificam assinaturas, persistência de identidade, expiração de sessão e renovação de cookies.

Para a demo, com servidor em execução:

```powershell
$env:TEST_BASE_URL = 'http://localhost:3000'
$env:AGENT_OPS_PATH = '/'
npm run test:browser
```

Se necessário, instale Chromium com `npx playwright install chromium`. Screenshots dos testes são ignorados pelo Git. Testes locais não substituem a validação autenticada na versão e configuração da sua instalação.

## Referências de protocolo

- [OpenClaw handshake](https://docs.openclaw.ai/gateway/protocol/handshake)
- [OpenClaw autenticação](https://docs.openclaw.ai/gateway/protocol/auth)
- [Hermes dashboard/API](https://hermes-agent.nousresearch.com/docs/user-guide/features/web-dashboard)
- [Hermes password login](https://github.com/NousResearch/hermes-agent/blob/main/hermes_cli/dashboard_auth/routes.py)

Nenhum deploy, serviço hospedado ou credencial de produção é provisionado pelo repositório.
