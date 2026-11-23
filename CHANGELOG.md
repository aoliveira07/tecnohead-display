# Changelog

## 0.7.0

- adiciona tela de Câmeras com pré-visualizações ao vivo via proxy autenticado do Home Assistant;
- adiciona navegação lateral por solução para Luzes, Clima, Persianas, Travas, Câmeras e Energia;
- aproxima clima, persianas e travas do visual Apple-like aprovado, com controles touch;
- permite configurar câmeras por cômodo junto das demais categorias do layout;
- adiciona ações de temperatura, modo HVAC e posição das persianas quando as entidades expõem esses comandos.

## 0.6.9

- substitui a silhueta por uma imagem real do Volvo EX40 cinza, recortada da referência enviada;
- aproxima o card da linguagem visual do aplicativo da Volvo, com leitura de bateria mais destacada e ações com ícones.

## 0.6.8

- adiciona card compacto da Volvo na Garagem, com bateria, autonomia, odômetro, carregamento e conexão;
- mostra o estado de portas, vidros, fechadura e alertas quando o Home Assistant disponibilizar essas entidades;
- expõe ações de climatização e tranca/destranca somente quando houver entidades de comando compatíveis.

## 0.6.7

- inclui Pillow no pacote do add-on para que a normalização de fotos funcione na imagem publicada;
- mantém as fotos do Immich em 1920x1080, com orientação EXIF corrigida e a foto inteira preservada.

## 0.6.6

- Normaliza as fotos do Immich para o canvas paisagem real do quiosque: 1920×1080.
- Corrige a orientação EXIF, preserva a foto inteira e cria preenchimento desfocado nas áreas restantes.

## 0.6.5

- Exibe a foto inteira no porta-retrato, sem corte, usando a própria imagem desfocada para preencher as laterais.
- Mantém o nome do arquivo fora da interface visível.

## 0.6.4

- Remove o nome do arquivo do porta-retrato.
- Faz as fotos preencherem o display com corte proporcional, sem barras pretas causadas pela diferença de proporção.

## 0.6.3

- Remove a duplicação de sensores técnicos da seção Garagem no editor, mantendo apenas controles, carregamento e métricas do veículo.

## 0.6.2

- Deixa a garagem focada nos controles e métricas úteis do Volvo e do carregador, sem despejar sensores técnicos na tela inicial.
- Atualiza a versão exibida pelo painel e pela API.

## 0.6.0

- Adiciona configuração persistente de cômodos, categorias e ordem dos dispositivos.
- Permite selecionar áreas e entidades pela própria tela, com arrastar, setas e salvamento.
- Inclui cartão preparado para Volvo XC40/EX40, bateria, carregamento, potência e conexão.
- Corrige o shell do quiosque para esconder a barra lateral do Home Assistant mesmo após mudanças no DOM.

## 0.6.1

- Inclui entidades Volvo/XC40/EX40 na descoberta da garagem.
- Mantém o editor e a grade principal focados nos controles úteis, deixando diagnósticos fora da tela inicial.

## 0.5.0

- Aproxima os cards de cômodos do mockup aprovado com ícones dedicados, nomes mais curtos e seleção de dispositivos por prioridade visual.
- Adiciona composição de Áudio e Vídeo com cartão visual de Spotify/Playlist Festa e preview da TV, sem iniciar a integração de conta ainda.
- Refinamento visual dos indicadores de energia, ícones e cartões multimídia.

## 0.4.1

- Corrige a tela Casa para esconder completamente a grade detalhada legada e remover a duplicação do atalho Garagem.

## 0.4.0

- Recria a home do display com a composição aprovada: contexto lateral, cômodos em blocos, áudio/vídeo, energia e navegação inferior.
- Adiciona cartões claros para dispositivos ativos e cartões grafite para dispositivos desligados, com anéis de nível para brilho e volume.

## 0.3.0

- Adiciona sincronização somente leitura de um álbum do Immich para cache persistente no Home Assistant.
- Adiciona porta-retrato digital após período configurável sem interação, com retorno ao painel por toque.
- Mantém credenciais do Immich no add-on; a chave nunca é enviada ao navegador nem versionada.

## 0.2.0

- Atualiza a interface para o layout grafite inspirado no mockup aprovado.
- Adiciona contexto lateral com relógio, saudação, dispositivos ativos e energia.
- Adiciona atalhos inferiores para casa, cenas, garagem e energia.
- Exibe anéis de nível para brilho, volume e posição quando o Home Assistant fornece esses dados.

## 0.1.4

- Torna a navegação lateral compatível com toque e caneta usando pointer events.
- Reforça a área de toque e o comportamento de rolagem dos cômodos.

## 0.1.3

- Força a reconstrução do contêiner e invalida os assets estáticos após a atualização.

## 0.1.2

- Reduz a renderização dos cômodos aos controles e mídias relevantes.
- Evita recarregar o painel inteiro antes de concluir um comando touch.
- Remove o blur por card para melhorar a fluidez do painel em hardware de quiosque.
- Otimiza o shell de tela cheia para não observar o iframe do aplicativo.

## 0.1.0

- Primeiro painel Tecnohead Display independente.
- Descoberta de áreas, entidades, cenas, energia e garagem.
- Interface touch em vidro laranja.

## 0.1.1

- Allow the display panel to be opened by non-admin Home Assistant users.

