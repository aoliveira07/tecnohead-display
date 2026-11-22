# Changelog

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

