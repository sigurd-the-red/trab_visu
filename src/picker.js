import * as d3 from 'd3';
import { PT } from './shared';

/**
 * createPicker — monta o seletor de países (um bloco por continente) dentro do elemento hostId.
 * Como: para cada continente cria um <details> cujo <summary> tem uma caixa "marcar o continente todo"
 * e, dentro, uma grade com uma caixa por país. As caixas alteram o conjunto "set" (países marcados) e
 * chamam onChange para redesenhar o gráfico. O estado visual (marcado / parcial) é sempre derivado do
 * conjunto. Devolve a função "change", para quem alterar o conjunto por código (botões) ressincronizar
 * as caixas e redesenhar.
 *  - hostId: seletor CSS do contêiner; entities: lista de países; set: Set com os nomes marcados;
 *  - onChange: função de redesenho.
 */
export function createPicker(hostId, entities, set, onChange) {
  const box = d3.select(hostId).html("");

  /**
   * sync — atualiza as caixas para refletir o conjunto "set".
   * Como: marca cada caixa de país que está no conjunto; para cada continente, marca a caixa dele se todos
   * os países estão marcados e usa o estado "indeterminate" (traço) se só alguns estão.
   */
  const sync = () => {
    box.selectAll("input[data-c]").property("checked", function () { return set.has(this.dataset.c); });
    box.selectAll("input[data-r]").each(function () {
      const list = entities.filter(e => e.region === this.dataset.r), k = list.filter(c => set.has(c.country)).length;
      this.checked = k === list.length; this.indeterminate = k > 0 && k < list.length;
    });
  };

  /**
   * change — sincroniza as caixas e chama o redesenho do gráfico.
   * Como: executa sync() e em seguida onChange(); é o que as caixas e os botões chamam após alterar o conjunto.
   */
  const change = () => { sync(); onChange(); };

  Object.keys(PT).forEach(r => {
    const list = entities.filter(e => e.region === r);
    const det = box.append("details").attr("open", r === "South America" ? "" : null);   // abre só a América do Sul
    const sum = det.append("summary");
    sum.append("input").attr("type", "checkbox").attr("data-r", r)
      .on("click", e => e.stopPropagation())                         // não abre/fecha o bloco ao marcar
      .on("change", e => { list.forEach(c => e.target.checked ? set.add(c.country) : set.delete(c.country)); change(); });
    sum.append("b").text(` ${PT[r]} (${list.length})`);
    const grid = det.append("div").attr("class", "grid");
    list.forEach(c => {
      const lb = grid.append("label");
      lb.append("input").attr("type", "checkbox").attr("data-c", c.country)
        .on("change", e => { e.target.checked ? set.add(c.country) : set.delete(c.country); change(); });
      lb.append("span").text(" " + c.country);
    });
  });
  sync();
  return change;
}
