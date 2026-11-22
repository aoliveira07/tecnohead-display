# Tecnohead Display

Painel touch independente para o Home Assistant, com visual em vidro laranja inspirado no layout escolhido para o monitor da cozinha.

Este projeto é separado do `tecnohead-multimidia`. Ele não importa código, não compartilha runtime e não depende daquele aplicativo.

## O que já existe

- painel landscape responsivo, otimizado para a proporção aproximada de 1366×768;
- navegação por Casa, cômodos descobertos, Garagem e Energia;
- descoberta de áreas, dispositivos e entidades pelo Home Assistant;
- cenas e scripts reais do Home Assistant como botões rápidos;
- cartões para luzes, interruptores, ventiladores, persianas, travas, botões, clima, sensores e media players;
- play/pause, stop, mudo, volume e fonte dos media players quando o Home Assistant expõe esses atributos;
- fluxo de energia sem valores inventados: Geração → Casa → Rede, mais armazenamento;
- garagem baseada na área e em nomes como garagem, carro, wallbox e carregador;
- backend intermediário: o token fica no add-on e nunca vai para o navegador;
- polling configurável para manter a tela atualizada.
- sincronização somente leitura de um álbum do Immich para um cache persistente no Home Assistant;
- porta-retrato digital após período configurável sem interação, retornando ao painel com um toque.
- editor de layout persistente para escolher áreas, categorias de dispositivos e ordem por cômodo;
- cartão da garagem preparado para dados reais do Volvo XC40/EX40, sem preencher leituras ausentes.

## Estrutura

`tecnohead_display/` é um add-on completo para um repositório de add-ons do Home Assistant. O add-on usa Ingress e aparece como **Tecnohead Display** no painel lateral do Home Assistant.

O backend lê os estados pela API REST e usa WebSocket apenas para os registries de áreas, entidades e dispositivos. A interface só recebe atributos seguros e necessários para exibição. Sensores secretos, códigos de IR e atributos desconhecidos não são encaminhados.

## Instalação no Home Assistant

1. Publique este repositório no GitHub.
2. No Home Assistant, abra **Configurações → Complementos → Loja de complementos → Repositórios**.
3. Adicione a URL deste repositório e instale **Tecnohead Display**.
4. Inicie o add-on e abra o painel pelo botão que o Home Assistant adicionará à barra lateral.

O endereço padrão dentro do add-on é `http://supervisor/core`, usando `SUPERVISOR_TOKEN`. O campo `ha_url` existe para desenvolvimento ou para uma instalação onde o Home Assistant esteja em outro endereço.

Para o porta-retrato, configure no add-on `immich_url`, `immich_api_key` e `immich_album_id`. O álbum é consultado por `POST /api/search/metadata`, as miniaturas são copiadas para o armazenamento persistente do add-on e a chave permanece apenas no backend.

## Desenvolvimento local

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
$env:HA_URL = "http://192.168.0.200:8123"
$env:HA_TOKEN = "seu_token_de_longa_duracao"
uvicorn tecnohead_display.app.main:app --reload --port 8099
```

Depois, abra `http://localhost:8099/`.

## Mapeamento de energia e garagem

O primeiro corte é intencionalmente automático para permitir instalação imediata. O painel classifica sensores por `device_class`, nome, entidade, dispositivo e cômodo. Para uma segunda etapa, podemos adicionar um arquivo de configuração explícito com os sensores exatos de geração, consumo, rede e bateria da casa, além de perfis para TV da piscina, Flep e outros equipamentos.

### Editor de layout

Na engrenagem do painel, **Configurar painel** permite selecionar as áreas do Home Assistant que serão espelhadas em Cozinha, Externo e Garagem. Dentro de cada área, as entidades são separadas em iluminação/acionamentos, áudio e vídeo e outros dispositivos. A seleção, a ordem e as categorias ficam persistidas em `/data/display-layout.json` no add-on; o modo automático continua sendo o padrão até o primeiro salvamento.

## Qualidade

```powershell
ruff check .
pytest -q
```

