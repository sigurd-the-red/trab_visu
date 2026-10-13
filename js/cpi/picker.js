import * as d3 from 'd3';
import { PT } from './shared.js';


// monta o seletor de paises, ou seja, permite selecionar certos paises ou outros para visualizar
export function createPicker(hostId, entities, set, onChange) {
  const box = d3.select(hostId).html("");

  
  //atualiza as caixas p/refletir o set 
  const sync = () => {
    box.selectAll("input[data-c]").property("checked", function () { return set.has(this.dataset.c); });
    box.selectAll("input[data-r]").each(function () {
      const list = entities.filter(e => e.region === this.dataset.r), k = list.filter(c => set.has(c.country)).length;
      this.checked = k === list.length; this.indeterminate = k > 0 && k < list.length;
    });
  };

  
  //sincroniza as caixas e chama o redesenho do grafico 
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
