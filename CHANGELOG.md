# Changelog

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

