# Tecnohead Display

Tecnohead Display é um app independente para Home Assistant. Ele usa Ingress para abrir a interface dentro do Home Assistant, preservando a autenticação da sessão do usuário.

## Configuração

O app usa `http://supervisor/core` por padrão e recebe `SUPERVISOR_TOKEN` automaticamente. A opção `ha_url` só precisa ser alterada para desenvolvimento local ou para uma topologia diferente.

`homeassistant_api: true` é necessário porque o painel lê registries/estados e envia comandos aos dispositivos. Esse token é tratado somente no backend do app; nunca é entregue ao JavaScript.

O porta-retrato usa as opções `immich_url`, `immich_api_key` e `immich_album_id`. O add-on sincroniza somente imagens do álbum para `/data/photo-frame`, com intervalo configurável, e serve apenas o cache local ao navegador. A chave de API do Immich não aparece no payload do painel.

## Interface

O layout foi pensado para uma tela touch horizontal próxima de 1366×768, com áreas descobertas automaticamente e três superfícies fixas: Garagem, Energia e Casa. O painel não inventa valores de energia: quando um sensor não existe ou está indisponível, mostra a ausência de leitura.

## Segurança operacional

As ações do primeiro corte são uma lista explícita de serviços: ligar/desligar/toggle, mídia básica, volume, fontes, capas, travas, botões, cenas, scripts, números e seleções. Ações arbitrárias e atributos desconhecidos não passam pela API.

