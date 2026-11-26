# Tecnohead Display

Tecnohead Display é um app independente para Home Assistant. Ele usa Ingress para abrir a interface dentro do Home Assistant, preservando a autenticação da sessão do usuário.

## Configuração

O app usa `http://supervisor/core` por padrão e recebe `SUPERVISOR_TOKEN` automaticamente. A opção `ha_url` só precisa ser alterada para desenvolvimento local ou para uma topologia diferente.

`homeassistant_api: true` é necessário porque o painel lê registries/estados e envia comandos aos dispositivos. Esse token é tratado somente no backend do app; nunca é entregue ao JavaScript.

O porta-retrato usa as opções `immich_url`, `immich_api_key` e `immich_album_id`. O add-on sincroniza somente imagens do álbum para `/data/photo-frame`, com intervalo configurável, e serve apenas o cache local ao navegador. A chave de API do Immich não aparece no payload do painel.

## Interface

O layout foi pensado para uma tela touch horizontal próxima de 1366×768, com áreas descobertas automaticamente e superfícies fixas para Casa, Câmeras, Garagem e Energia. A navegação lateral organiza as soluções em luzes, clima, persianas, travas, câmeras e energia. O painel não inventa valores de energia: quando um sensor não existe ou está indisponível, mostra a ausência de leitura.

### Configuração do display

Abra a engrenagem no Tecnohead Display para editar a configuração armazenada pelo backend. O editor permite escolher o tema Apple Home, a cor de destaque, a barra lateral, a ordem e os rótulos da navegação, além do cômodo, do ícone e do nome exibidos para cada entidade. A seleção por categoria inclui iluminação, clima, mídia, persianas, travas, câmeras e outros dispositivos. O backend aceita somente chaves de ícones conhecidas e grava o resultado em `/data/display-layout.json`.

As imagens das entidades `camera.*` são obtidas pelo endpoint interno `/api/camera/<entity_id>`. O backend faz o proxy para `/api/camera_proxy` do Home Assistant usando o token do add-on; o token nunca chega ao navegador.

## Segurança operacional

As ações do primeiro corte são uma lista explícita de serviços: ligar/desligar/toggle, mídia básica, volume, fontes, capas, travas, botões, cenas, scripts, números e seleções. Ações arbitrárias e atributos desconhecidos não passam pela API.

