# Política de segurança

## Versões com suporte

Somente a versão mais recente publicada em [Releases](../../releases) recebe correções.

## Como reportar uma vulnerabilidade

Por favor, **não abra uma issue pública** para falhas de segurança.

Use o reporte privado do GitHub: aba **Security → Report a vulnerability** deste repositório. Descreva:

- o que acontece e qual o impacto;
- passos para reproduzir;
- versão do launcher e do Windows.

## O que está no escopo

- O código deste repositório (`src/`) e os executáveis publicados em Releases.
- Formas de uma página carregada no launcher acessar o sistema, arquivos ou outras contas.
- Formas de os dados do launcher saírem da máquina sem ação do usuário.

Fora do escopo: o jogo LoL Idle em si e vulnerabilidades do Chromium/Electron já corrigidas em versões mais novas (nesse caso, avise para atualizarmos).

## Modelo de segurança, em resumo

- Interface e contas rodam com `sandbox`, `contextIsolation` e sem `nodeIntegration`.
- Todo `<webview>` é validado pelo processo principal antes de ser criado: só `https://lolidle.com`, cada conta numa sessão isolada, com o preload do launcher.
- As contas não navegam para fora do lolidle.com (exceto a página de login do Google, para quem entra com Google); links externos abrem no navegador padrão.
- O isolamento de sites do Chromium fica ligado (o captcha da Cloudflare depende dele).
- Câmera, microfone, localização e afins são negados.
- O launcher não faz requisições de rede próprias, não tem telemetria e nunca lê ou guarda senhas.
- O launcher não clica, não digita e não altera a comunicação do jogo: só lê o que aparece na tela.
