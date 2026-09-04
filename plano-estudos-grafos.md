# Plano de estudos — Grafos até 3.2

O material-base é o PDF *Teoria dos Grafos: Uma breve introdução com algoritmos*, de Jair Donadelli. O recorte solicitado abrange os capítulos 1 e 2 completos e as seções 3.1 e 3.2 do capítulo 3, totalizando conceitos básicos, percursos, caminhos mínimos, conexidade, articulações e componentes biconexos.

## 1. Organização sugerida

Sugiro um plano de **14 dias**, estudando entre 1 e 2 horas por dia.

| Dia | Conteúdo principal | Atividade |
|---|---|---|
| 1 | Definição de grafo, vértices, arestas e graus | Resolver exercícios de representação |
| 2 | Teorema do aperto de mãos e propriedades dos graus | Calcular graus e verificar sequências |
| 3 | Subgrafos, cliques e conjuntos independentes | Identificar subgrafos em exemplos |
| 4 | Grafos bipartidos e coloração | Testar bipartição e procurar ciclos ímpares |
| 5 | Isomorfismo e tipos especiais de grafos | Comparar grafos usando invariantes |
| 6 | Listas e matrizes de adjacência | Representar o mesmo grafo das duas formas |
| 7 | Passeios, caminhos, circuitos e distância | Encontrar caminhos mínimos sem pesos |
| 8 | Trilhas e grafos eulerianos | Aplicar o Teorema de Euler |
| 9 | Percurso genérico, BFS e DFS | Simular os algoritmos em um grafo |
| 10 | Caminhos mínimos com pesos | Estudar relaxação e Dijkstra |
| 11 | Floyd–Warshall e revisão de algoritmos | Montar uma matriz de distâncias |
| 12 | Grafos conexos e componentes conexos | Encontrar componentes usando BFS/DFS |
| 13 | Pontes, cortes e articulações | Verificar o que acontece ao remover elementos |
| 14 | Componentes biconexos e revisão geral | Resolver uma lista mista e fazer um resumo |

### Método para cada sessão

1. Leia as definições do PDF.
2. Reescreva cada definição com suas próprias palavras.
3. Desenhe pelo menos um exemplo.
4. Resolva dois exercícios teóricos e dois computacionais.
5. Explique o conteúdo em voz alta ou escreva um pequeno resumo.
6. Revise os conceitos anteriores por 10 minutos.

***

# 2. Conceitos básicos

## 2.1 Grafo

Um grafo simples é um par ordenado

\[
G=(V,E),
\]

em que:

- \(V\) é o conjunto de vértices;
- \(E\) é o conjunto de arestas;
- cada aresta liga dois vértices distintos.

Formalmente,

\[
E\subseteq \binom{V}{2}.
\]

### Exemplo

Considere

\[
V=\{1,2,3,4\}
\]

e

\[
E=\{\{1,2\},\{2,3\},\{3,4\}\}.
\]

Esse grafo representa o caminho

\[
1-2-3-4.
\]

A **ordem** do grafo é o número de vértices:

\[
|V|=4.
\]

O **tamanho** do grafo, conforme o PDF, é

\[
|V|+|E|.
\]

Neste exemplo, o tamanho é \(4+3=7\).

## 2.2 Adjacência e incidência

Dois vértices são **adjacentes** quando existe uma aresta ligando-os.

Se \(e=\{u,v\}\), então \(u\) e \(v\) são os extremos de \(e\), e a aresta é incidente nesses dois vértices.

A **vizinhança** de \(v\), indicada por \(N(v)\), é o conjunto dos vértices adjacentes a \(v\).

### Exemplo

No grafo

\[
E=\{\{1,2\},\{1,3\},\{2,4\}\},
\]

temos:

\[
N(1)=\{2,3\},
\qquad
N(2)=\{1,4\},
\qquad
N(3)=\{1\}.
\]

## 2.3 Grau

O **grau** de um vértice \(v\), denotado por \(d(v)\), é o número de vizinhos de \(v\).

No exemplo anterior:

\[
d(1)=2,\quad d(2)=2,\quad d(3)=1,\quad d(4)=1.
\]

Também são importantes:

- grau mínimo:

\[
\delta(G)=\min_{v\in V}d(v);
\]

- grau máximo:

\[
\Delta(G)=\max_{v\in V}d(v);
\]

- grau médio:

\[
d(G)=\frac{1}{|V|}\sum_{v\in V}d(v).
\]

## 2.4 Teorema do aperto de mãos

O PDF apresenta o resultado:

\[
\sum_{v\in V}d(v)=2|E|.
\]

A razão é que cada aresta contribui uma unidade para o grau de cada um dos seus dois extremos.

### Exemplo

Se um grafo tem 5 arestas, a soma dos graus de todos os vértices é

\[
2\cdot5=10.
\]

### Consequência

O número de vértices de grau ímpar é sempre par.

Por exemplo, não pode existir um grafo com exatamente três vértices de grau ímpar.

***

# 3. Subgrafos, cliques e bipartição

## 3.1 Subgrafo

Um grafo \(H\) é subgrafo de \(G\) quando:

\[
V(H)\subseteq V(G)
\]

e

\[
E(H)\subseteq E(G).
\]

Ou seja, podemos obter \(H\) removendo vértices, arestas ou ambos.

### Subgrafo induzido

Dado um conjunto \(U\subseteq V(G)\), o subgrafo induzido \(G[U]\) contém:

- exatamente os vértices de \(U\);
- todas as arestas de \(G\) cujos dois extremos pertencem a \(U\).

### Exemplo

Se

\[
E(G)=\{\{1,2\},\{1,3\},\{2,3\},\{3,4\}\}
\]

e \(U=\{1,2,3\}\), então

\[
G[U]
\]

é o triângulo formado por 1, 2 e 3.

## 3.2 Clique

Uma **clique** é um conjunto de vértices em que todo par de vértices é adjacente.

Uma clique com \(k\) vértices é chamada de \(k\)-clique.

### Exemplo

Se os vértices 1, 2 e 3 são todos adjacentes entre si, então

\[
\{1,2,3\}
\]

é uma 3-clique, também chamada de triângulo.

O grafo completo com \(n\) vértices é denotado por \(K_n\). Nele, todo par de vértices forma uma aresta.

O número de arestas de \(K_n\) é

\[
|E(K_n)|=\binom n2=\frac{n(n-1)}2.
\]

## 3.3 Conjunto independente

Um **conjunto independente** é um conjunto de vértices que não possui arestas entre seus elementos.

### Exemplo

Em um grafo com arestas

\[
\{1,2\},\{2,3\},\{3,4\},
\]

o conjunto \(\{1,3\}\) **é** independente, pois não existe aresta ligando 1 e 3 diretamente. Já \(\{1,2\}\) **não** é independente, pois há uma aresta entre esses dois vértices.

A maior clique e o maior conjunto independente são parâmetros importantes, mas o PDF destaca que encontrar esses conjuntos pode ser computacionalmente difícil em geral.

## 3.4 Grafo bipartido

Um grafo é **bipartido** quando seus vértices podem ser divididos em dois conjuntos independentes \(A\) e \(B\):

\[
V=A\cup B,
\qquad
A\cap B=\varnothing.
\]

Todas as arestas devem ligar um vértice de \(A\) a um vértice de \(B\).

### Exemplo

Considere:

\[
A=\{a_1,a_2\},
\qquad
B=\{b_1,b_2,b_3\}.
\]

As arestas podem ser:

\[
\{a_1,b_1\},\{a_1,b_2\},\{a_2,b_2\}.
\]

Não pode existir uma aresta entre \(a_1\) e \(a_2\), nem entre \(b_1\) e \(b_2\).

O grafo bipartido completo com partes de tamanhos \(m\) e \(n\) é denotado por \(K_{m,n}\), e possui

\[
|E(K_{m,n})|=mn
\]

arestas.

## 3.5 Critério do ciclo ímpar

Um resultado fundamental é:

> Um grafo é bipartido se, e somente se, não contém circuito de comprimento ímpar.

Por exemplo:

- um ciclo de 4 vértices pode ser bipartido;
- um triângulo não pode ser bipartido;
- qualquer grafo com um triângulo não é bipartido.

Esse critério também fundamenta o algoritmo de busca em largura para testar bipartição.

***

# 4. Isomorfismo e representação

## 4.1 Isomorfismo

Dois grafos \(G\) e \(H\) são **isomorfos** quando possuem a mesma estrutura de adjacência, embora os vértices possam ter nomes diferentes.

Existe uma bijeção

\[
f:V(G)\to V(H)
\]

tal que

\[
\{u,v\}\in E(G)
\]

se, e somente se,

\[
\{f(u),f(v)\}\in E(H).
\]

### Exemplo

Os grafos

\[
a-b-c
\]

e

\[
1-2-3
\]

são isomorfos. Basta definir:

\[
f(a)=1,\quad f(b)=2,\quad f(c)=3.
\]

### Invariantes úteis

Para verificar se dois grafos não são isomorfos, podemos comparar:

- número de vértices;
- número de arestas;
- sequência de graus;
- número de componentes;
- existência de triângulos;
- número de ciclos;
- graus mínimo e máximo.

Se algum desses valores for diferente, os grafos não são isomorfos.

## 4.2 Tipos de grafos

O material também diferencia:

- **grafo com pesos:** cada aresta possui um valor, como distância ou custo;
- **grafo orientado (ou dirigido):** as arestas têm uma orientação, sendo representadas como pares ordenados de vértices;
- **multigrafo:** pode haver várias arestas entre os mesmos vértices.

## 4.3 Lista de adjacências

Na lista de adjacências, cada vértice armazena seus vizinhos.

### Exemplo

Para

\[
E=\{\{1,2\},\{1,3\},\{2,4\}\},
\]

podemos escrever:

```text
1: 2, 3
2: 1, 4
3: 1
4: 2
```

Essa representação é adequada para grafos esparsos, isto é, grafos com relativamente poucas arestas.

## 4.4 Matriz de adjacências

A matriz de adjacências \(A\) é definida por:

\[
A(i,j)=
\begin{cases}
1,&\text{se } \{i,j\}\in E;\\
0,&\text{caso contrário.}
\end{cases}
\]

Para o exemplo anterior, usando a ordem \(1,2,3,4\):

\[
A=
\begin{bmatrix}
0&1&1&0\\
1&0&0&1\\
1&0&0&0\\
0&1&0&0
\end{bmatrix}.
\]

Para grafos não dirigidos, a matriz é simétrica.

### Comparação

| Operação | Matriz | Lista |
|---|---:|---:|
| Verificar se \(\{i,j\}\) existe | \(O(1)\) | até \(O(|V|)\) |
| Obter os vizinhos de \(i\) | \(O(|V|)\) | \(O(d(i))\) |
| Armazenamento | \(O(|V|^2)\) | \(O(|V|+|E|)\) |

***

# 5. Passeios, caminhos e circuitos

## 5.1 Passeio

Um **passeio** é uma sequência de vértices consecutivos adjacentes. Os vértices podem se repetir.

### Exemplo

Se existem as arestas \(1-2\), \(2-3\) e \(3-1\), então

\[
1,2,3,2,1
\]

é um passeio.

## 5.2 Caminho

Um **caminho** é um passeio sem repetição de vértices.

No mesmo triângulo,

\[
1,2,3
\]

é um caminho, mas

\[
1,2,3,2
\]

não é.

O comprimento de um caminho é o número de arestas utilizadas.

Atenção: um caminho com \(k\) vértices possui \(k-1\) arestas.

## 5.3 Circuito

Um **circuito** é um caminho fechado, com pelo menos três vértices, em que o primeiro e o último vértice coincidem.

### Exemplo

\[
1,2,3,1
\]

é um circuito de comprimento 3.

A **cintura** do grafo é o comprimento do menor circuito nele contido.

## 5.4 Distância

A distância entre dois vértices \(u\) e \(v\), indicada por

\[
\operatorname{dist}(u,v),
\]

é o comprimento de um menor caminho entre eles.

### Exemplo

Se o menor caminho entre \(a\) e \(d\) é

\[
a-b-c-d,
\]

então

\[
\operatorname{dist}(a,d)=3.
\]

Se não houver caminho entre os vértices, define-se:

\[
\operatorname{dist}(u,v)=\infty.
\]

O **diâmetro** do grafo é a maior distância entre dois vértices.

***

# 6. Trilhas e grafos eulerianos

## 6.1 Trilha

Uma **trilha** é uma sequência que não repete arestas. Os vértices podem aparecer mais de uma vez.

Uma trilha fechada começa e termina no mesmo vértice.

## 6.2 Trilha euleriana

Uma **trilha euleriana** percorre todas as arestas do grafo exatamente uma vez.

Uma **trilha euleriana fechada** percorre todas as arestas exatamente uma vez e retorna ao ponto inicial.

Um grafo que possui uma trilha euleriana fechada é chamado de **euleriano**.

## 6.3 Teorema de Euler

Para um multigrafo conexo:

> O grafo é euleriano se, e somente se, todos os vértices têm grau par.

Além disso:

- se todos os graus são pares, existe uma trilha euleriana fechada;
- se exatamente dois vértices têm grau ímpar, existe uma trilha euleriana aberta;
- se há mais de dois vértices ímpares, não existe trilha euleriana.

Esse resultado nasceu do problema das sete pontes de Königsberg, considerado um dos primeiros problemas da Teoria dos Grafos.

### Exemplo

Graus:

\[
2,2,4,2
\]

indicam que o grafo pode ser euleriano, desde que seja conexo.

Graus:

\[
1,2,2,1
\]

indicam a existência possível de uma trilha euleriana aberta.

***

# 7. Busca em largura e profundidade

## 7.1 Busca em largura — BFS

A **BFS** explora os vértices por camadas:

1. começa em um vértice;
2. visita seus vizinhos;
3. depois visita os vizinhos desses vizinhos;
4. continua até não haver vértices novos.

Ela utiliza uma fila: o primeiro vértice inserido é o primeiro a ser processado.

### Aplicações

- encontrar componentes conexos;
- calcular distâncias em grafos sem pesos;
- encontrar caminhos com menor número de arestas;
- verificar se o grafo é bipartido.

Em listas de adjacências, sua complexidade é:

\[
O(|V|+|E|).
\]

A BFS encontra distâncias mínimas em grafos não ponderados porque visita primeiro os vértices mais próximos da origem.

## 7.2 Busca em profundidade — DFS

A **DFS** explora um caminho o máximo possível antes de voltar e tentar outra alternativa.

Ela pode ser implementada com:

- recursão;
- pilha.

### Exemplo intuitivo

Ao iniciar em \(a\), a DFS pode visitar:

\[
a\to b\to d,
\]

voltar para \(b\), explorar outro vizinho e só depois retornar para \(a\).

### Aplicações

- encontrar componentes conexos;
- detectar ciclos;
- localizar pontes;
- localizar articulações;
- construir árvores de busca;
- encontrar componentes fortemente conexos em grafos dirigidos.

Sua complexidade, usando listas de adjacências, também é:

\[
O(|V|+|E|).
\]

A ideia de explorar até onde for possível e retroceder é a característica central da DFS.

***

# 8. Caminhos mínimos com pesos

## 8.1 Grafo ponderado

Em um grafo ponderado, cada aresta possui um peso:

\[
\rho:E\to\mathbb{R}.
\]

O custo de um caminho é a soma dos pesos de suas arestas.

### Exemplo

Se:

\[
a\xrightarrow{4}b,\qquad b\xrightarrow{3}c,
\]

então o caminho \(a-b-c\) possui custo

\[
4+3=7.
\]

## 8.2 Algoritmo de Dijkstra

O algoritmo de Dijkstra encontra as menores distâncias a partir de uma origem quando os pesos são não negativos.

A ideia é:

1. definir distância 0 para a origem;
2. definir distância infinita para os demais vértices;
3. escolher o vértice não processado com menor distância conhecida;
4. tentar melhorar as distâncias de seus vizinhos;
5. repetir.

A operação de tentar melhorar uma distância é chamada de **relaxação**:

\[
d(t)\leftarrow \min\{d(t),d(u)+w(u,t)\}.
\]

### Exemplo

Se:

\[
d(u)=5
\]

e a aresta \(u-t\) possui peso 2, então uma possibilidade para \(t\) é:

\[
5+2=7.
\]

Se a distância atual de \(t\) era 10, ela passa a ser 7.

Com uma fila de prioridades baseada em heap binária, a complexidade apresentada no PDF é:

\[
O((|V|+|E|)\log |V|).
\]

O algoritmo não deve ser usado diretamente com pesos negativos.

## 8.3 Floyd–Warshall

O algoritmo de Floyd–Warshall calcula as menores distâncias entre todos os pares de vértices.

A recorrência é:

\[
d_{ij}^{(k)}
=
\min\left(
d_{ij}^{(k-1)},
d_{ik}^{(k-1)}+d_{kj}^{(k-1)}
\right).
\]

Sua complexidade é:

\[
O(|V|^3).
\]

Ele é útil quando se deseja obter uma matriz completa de distâncias.

***

# 9. Conexidade

## 9.1 Grafo conexo

Um grafo é **conexo** quando existe um caminho entre qualquer par de vértices.

### Exemplo conexo

\[
1-2-3-4
\]

é conexo, pois todos os vértices podem ser alcançados a partir de qualquer outro.

### Exemplo desconexo

\[
1-2
\qquad
3-4
\]

é desconexo, pois não existe caminho entre 1 e 3.

O PDF também caracteriza a conexidade por cortes: um grafo é conexo se, para todo subconjunto próprio e não vazio \(U\), existe pelo menos uma aresta entre \(U\) e seu complemento.

## 9.2 Componentes conexos

Uma **componente conexa** é um subgrafo conexo maximal.

Em outras palavras, é um grupo de vértices em que:

- todo vértice alcança os demais;
- não é possível adicionar outro vértice sem perder essa propriedade.

### Exemplo

Se o grafo possui as arestas

\[
\{1,2\},\{2,3\},\{4,5\},
\]

suas componentes conexas são:

\[
\{1,2,3\}
\]

e

\[
\{4,5\}.
\]

Um vértice isolado também forma uma componente conexa.

### Como encontrar

Execute BFS ou DFS:

1. escolha um vértice não visitado;
2. execute BFS/DFS a partir dele;
3. todos os vértices alcançados formam uma componente;
4. escolha outro vértice não visitado;
5. repita.

A complexidade total é:

\[
O(|V|+|E|).
\]

Esse procedimento é padrão para encontrar todas as componentes conexas.

## 9.3 Pontes

Uma **ponte** é uma aresta cuja remoção aumenta o número de componentes conexas.

### Exemplo

No caminho

\[
1-2-3,
\]

as arestas \(\{1,2\}\) e \(\{2,3\}\) são pontes.

Em um triângulo, nenhuma aresta é ponte, porque, mesmo removendo uma aresta, os dois extremos continuam conectados pela outra parte do ciclo.

Uma aresta que pertence a algum circuito não é ponte: existe um caminho alternativo entre seus extremos. O PDF demonstra justamente essa propriedade.

## 9.4 Cortes

Para \(U\subseteq V\), o **corte definido por \(U\)** é o conjunto de arestas com um extremo em \(U\) e outro em \(V\setminus U\).

Usando a notação do material:

\[
E(U,\overline U).
\]

### Exemplo

Se

\[
U=\{1,2\}
\]

e o grafo possui as arestas \(\{1,3\}\), \(\{2,4\}\) e \(\{1,2\}\), então o corte é:

\[
E(U,\overline U)=\{\{1,3\},\{2,4\}\}.
\]

A aresta \(\{1,2\}\) não pertence ao corte porque seus dois extremos estão em \(U\).

***

# 10. Articulações e conexidade de vértices

## 10.1 Articulação

Uma **articulação**, ou vértice de corte, é um vértice cuja remoção desconecta o grafo ou aumenta o número de componentes conexas.

### Exemplo

Considere:

\[
1-2-3
\]

O vértice 2 é uma articulação. Ao removê-lo, sobram dois componentes:

\[
\{1\}
\qquad
\{3\}.
\]

Em um ciclo, nenhum vértice é articulação, pois há sempre um caminho alternativo.

## 10.2 Grafo biconexo

Um grafo conexo sem articulações é chamado de **biconexo**.

A ideia é que o grafo tolera a remoção de qualquer um de seus vértices sem deixar de ser conexo.

### Exemplos

- Um ciclo \(C_n\), com \(n\geq 3\), é biconexo.
- Um caminho com pelo menos três vértices não é biconexo.
- Um grafo formado por dois ciclos que compartilham um único vértice possui esse vértice como articulação.

## 10.3 Componentes biconexos

As **componentes biconexas** são os subgrafos biconexos maximais.

Elas podem compartilhar articulações, mas não possuem, em geral, estruturas biconexas maiores que as contenham.

### Exemplo

Se dois triângulos compartilham apenas o vértice \(v\):

\[
(a,b,v)
\qquad\text{e}\qquad
(v,c,d),
\]

cada triângulo é uma componente biconexa, e \(v\) é uma articulação.

## 10.4 DFS para articulações

O PDF utiliza uma DFS rotulada com:

- tempo de chegada;
- tempo de saída;
- vetor de pais;
- relação entre ancestrais e descendentes.

A caracterização é:

- a raiz da DFS é articulação se possuir mais de um filho;
- um vértice não raiz é articulação quando possui um filho cuja subárvore não consegue alcançar, por arestas de retorno, nenhum ancestral próprio desse vértice.

A ideia computacional é medir até que ancestral cada subárvore consegue retornar. Esse método é conhecido como técnica de valores de baixo alcance (*low-link*) e permite encontrar articulações em tempo linear. A condição para pontes também pode ser expressa pela ausência de arestas de retorno na subárvore de DFS.

***

# 11. Exercícios prioritários

Para consolidar o conteúdo, recomendo priorizar estes exercícios do PDF:

- Exercícios 3 a 16: definições, graus e propriedades básicas.
- Exercícios 19 a 28: subgrafos, cliques e conjuntos independentes.
- Exercícios 29 a 38: grafos bipartidos e cortes.
- Exercícios 44 a 54: isomorfismo.
- Exercícios 57 a 68: representações e complexidade.
- Exercícios 69 a 80: caminhos, circuitos e bipartição.
- Exercícios 83 a 94: trilhas e buscas.
- Exercícios 95 a 105: caminhos mínimos.
- Exercícios 106 a 112: conexidade, pontes, articulações e algoritmo de Fleury.

## Checklist final

Antes da prova ou da revisão, verifique se você consegue:

- definir grafo, subgrafo, clique e conjunto independente;
- calcular graus e aplicar o teorema do aperto de mãos;
- explicar a diferença entre passeio, caminho, trilha e circuito;
- identificar se um grafo é bipartido;
- reconhecer grafos isomorfos usando invariantes;
- converter uma lista de adjacências em matriz;
- executar BFS e DFS manualmente;
- encontrar componentes conexas;
- aplicar o Teorema de Euler;
- calcular caminhos mínimos com Dijkstra;
- explicar o que é uma ponte;
- identificar articulações;
- distinguir grafo conexo, biconexo e desconexo.
