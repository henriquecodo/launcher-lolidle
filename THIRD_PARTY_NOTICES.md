# Avisos de terceiros

## Electron

O executável inclui o [Electron](https://github.com/electron/electron) (licença MIT), que inclui o Chromium e o Node.js. As licenças completas desses componentes acompanham o executável (`LICENSE.electron.txt` e `LICENSES.chromium.html`).

## Lucide

Os ícones em [`src/renderer/icons.js`](src/renderer/icons.js) são baseados no conjunto [Lucide](https://lucide.dev).

```
ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT).
All other copyright (c) for Lucide are held by Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

## Calculadora de build

A calculadora ([src/game/build-engine.js](src/game/build-engine.js)) é código próprio do launcher. Ela usa o módulo de regras do jogo (`lolidle.com/js/motor.js`), importado ao vivo dentro da conta, no seu computador, só quando você pede o cálculo. O launcher **não** inclui nem redistribui esse módulo. O resultado de exemplo usado nos prints (`src/demo/`, fora do executável) foi gerado por essa mesma calculadora e contém textos curtos do jogo (nomes e efeitos dos atributos).

## LoL Idle / League of Legends

O LoL Idle é um jogo independente feito por fãs, de seus respectivos donos. League of Legends e todas as propriedades associadas são marcas da Riot Games, Inc. Este projeto não tem vínculo com o LoL Idle nem com a Riot Games e não distribui nenhum recurso (imagens, sons, código) do jogo — o jogo é carregado diretamente do site oficial.
