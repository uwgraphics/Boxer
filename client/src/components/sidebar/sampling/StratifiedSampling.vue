<template>


  <v-expansion-panels
    v-model="panel"
    multiple
  >
  
  
   

    <v-expansion-panel>
      
      <v-expansion-panel-header>Stratified Sampling</v-expansion-panel-header>


      <div style="margin-left: 10%; font-size: 14px; stroke: 'black'; stroke-width:2px; " >
        <input v-model="sample_size" placeholder="edit me">
        <p>  Total sample size</p>   
      </div>   

      <multiselect v-model="value" :options="options" 
          :multiple="true" 
          :close-on-select="false" 
          :clear-on-select="false" 
          :preserve-search="true" 
          placeholder="Pick sets" label="name" track-by="name" 
          :preselect-first="true">
          <template slot="selection" slot-scope="{ values, search, isOpen }">
            <span class="multiselect__single" v-if="values.length &amp;&amp; !isOpen">
              {{ values.length }} 
              options selected
            </span>
          </template>
        </multiselect>

        <!-- <div class="table-container">
          <v-data-table
            :headers="headers"
            :items="value"
            class="elevation-1"
            :options.sync="pagination"
            disable-sort
            dense
          >
            <template v-slot:body="{ items }">
              <tbody>
                <tr
                  v-for="item in items"
                  :key="item.name"
                  :style="styleTableRow(item)"
                >
                  <td>{{ item.name }}</td>
                  <td> <input v-model = "sample_weight[item.name]"  placeholder="edit me"> </td>
                </tr>
              </tbody>
            </template>
          </v-data-table>
        </div> -->

        <div ref="svg_stratified" />
      </v-expansion-panel>
  </v-expansion-panels>
  
</template>

<script lang="ts">
import Vue from 'vue';
import { colors } from '../../../theme';
import {
  Instance,
  SelectionRecord,
  EntityType,
  SelectionAction,
  SetCompose,
  modelSelectionRecord,
  ThresholdWithClassifier,
} from '../../../types';
import {
  instanceById,
  intersection,
} from '../../../utils';
import * as d3 from 'd3';

export default Vue.extend({
  name: 'StratifiedSampling',

  data() {
    const addSampling = {
      sampling: '',
    };
    return {
      addSampling, 
      sample_size: 0,
      pagination: {
        rowsPerPage: 5,
      },
      headers: [
        { text: 'Name', value: 'name' },
        { text: 'Weight', value: 'weight' },
        // { text: 'Description', value: 'description' },
      ],
      value: [],
      panel: [] as string[],
      checkedBoxes: [] as string[],
    };
  },
  computed: {
    sampled_value() : [] {
      return this.$store.state.sampleList;
    },
    sample_weight(): {} {
      const features = [...this.$store.getters.features];
      const categorial_features =  [...this.$store.getters.features].filter((f) => {
        return this.$store.getters.feature(f).type === 'categorical'});

      let weight_dicts = {}
      // categorial_features.forEach((f)=>{
      //   weight_dicts[f] = 0;
      // })

      categorial_features.forEach((c)=>{
          this.$store.getters.feature(c).categories.forEach((i)=>{
            weight_dicts[c+"*"+i] = 0
          })
      })
      return weight_dicts
    },
    overlapSelections(): {
      first: SelectionRecord | null,
      second: SelectionRecord | null,
    } {
      return this.$store.state.overlapSelections;
    },
    instances(): string[] {
      return [...this.$store.getters.instances];
    },
    classList(): string[] {
      return [...this.$store.getters.classes];
    },
    options(): any[] {
      let options = []
      const features = [...this.$store.getters.features];
      const categorial_features =  [...this.$store.getters.features].filter((f) => {
        return this.$store.getters.feature(f).type === 'categorical'});

      // categorial_features.forEach((c)=>{
      //     this.$store.getters.feature(c).categories.forEach((i)=>{
      //       options.push({name: c+"*"+i})
      //     })
      // })
      categorial_features.forEach((f)=>{
        options.push({name:f})
      })
      options.push({name:'target class'})

      return options
    },
  },
  watch: {
   
    addSampling() {
      // add sample to the table
      // let idx = this.sampled_value.length;
      
      // let instances = this.instances;
      // let samples = []


 
      // // get the total weights chosen features
      // let total_weight = 0
      // for (let key in this.sample_weight) {        
      //   total_weight += (parseInt(this.sample_weight[key]))
      // }


      // // get the sample size for each feature and do stratified sampling
      // for (let key in this.sample_weight) {
      //   console.log("key",key)
      //   let tmp_feature_sample = []
      //   if (this.sample_weight[key] == '0') {
      //     continue
      //   }
      //   let sample_size = this.sample_size * parseInt(this.sample_weight[key]) / total_weight
      //   // create a dict to record sample_size of each category of current feature
      //   let cate_dict = {};
      //   this.$store.getters.feature(key).categories.forEach((c)=>{
      //     cate_dict[c] = []
      //   })
      //   instances.forEach((id) => {
      //       const category = instanceById(id).features[key];
      //       cate_dict[category].push(id);
      //   });
      //   // console.log(cate_dict)
      //   for (let cate in cate_dict) {
      //     let tmp_sample_size = Math.round(sample_size * cate_dict[cate].length / instances.length);
      //     let tmp_samples = randomIntegers(0,instances.length, tmp_sample_size, cate_dict[cate]);
      //     tmp_samples.forEach((c)=>{
      //       tmp_feature_sample.push(c)
      //     })
      //   }
      //   samples.push({name: key, samples: tmp_feature_sample});
      // }


      // let tmpValue = [];
      // this.sampled_value.forEach((v)=>{
      //   tmpValue.push(v)
      // })
      // for (let feature_idx in samples) {
      //   let feature_item = samples[feature_idx]
      //   tmpValue.push({decription:'stratified',id:idx, name: idx + "_stratified", size: feature_item['samples'].length, instances: new Set(feature_item['samples'])})
      //   idx += 1
      // }
    

      
      // this.$store.dispatch('changedSampledList', tmpValue);
      let cur_feature = this.value.length > 0? this.value[0].name: '';
      let idx = this.sampled_value.length
      let instances = this.instances;
      let samples = []
console.log(this.classList)
      let cate_dict = {};
      if (cur_feature != 'target class') {
        this.$store.getters.feature(cur_feature).categories.forEach((c)=>{
          cate_dict[c] = []
        })
        instances.forEach((id) => {
            const category = instanceById(id).features[cur_feature];
            cate_dict[category].push(id);
        });
      } else {
        this.classList.forEach((c)=>{
          cate_dict[c] = []
        })
        instances.forEach((id) => {
            const category = instanceById(id).actual;
            cate_dict[category].push(id);
        });
      }
      
      console.log('cate_dict',cate_dict)
      let tmp_feature_sample = []
      let sample_size = this.sample_size ;
      for (let cate in cate_dict) {
        console.log(sample_size,  cate_dict[cate].length,  instances.length)
        let tmp_sample_size = Math.floor(sample_size * cate_dict[cate].length / instances.length);
        let tmp_samples = randomIntegers(0,instances.length, tmp_sample_size, cate_dict[cate]);
        tmp_samples.forEach((c)=>{
          tmp_feature_sample.push(c)
        })
      }

      let tmpValue = []
      tmpValue.push({decription:'stratified',id:idx, name: idx + "_stratified", size: tmp_feature_sample.length, instances: new Set(tmp_feature_sample)})
      this.$store.dispatch('changedSampledList', tmpValue);

      function randomIntegers(min, max, num, instances) {
        let randomArrays = []
        let randomSet = new Set()
        let i = 0
        while ( randomSet.size < num) {
          let tmp = Math.floor(Math.random() * instances.length)
          randomArrays.push(tmp.toString())
          randomSet = new Set(randomArrays)
          i += 1
        }
        return randomArrays;
      }
      
    },
    classifierThresholdDict() {
      this.drawInitial();
    },
    thresholdClassifierNameList() {
      this.drawInitial();
    },
  },
  mounted() {
    this.drawInitial();
  },
  methods: {
    showInput(
      payload: {
        selection:  null,
      },
    ) {
      console.log('showinput',payload)
    },
    setOverlapSampling(
      payload: {
        selection:  null,
      },
    ) {
      this.$store.dispatch('changedToSamplingData', payload);
    },
    styleTableRow(record: SelectionRecord) {
      const { first: firstColor, second: secondColor } = colors.overlapSelections;
      const { first: firstSelection, second: secondSelection } = this.overlapSelections;
      const isFirst = (firstSelection && firstSelection.id === record.id);
      const isSecond = (secondSelection && secondSelection.id === record.id);

      if (isFirst && isSecond) {
        return `
          background: -webkit-linear-gradient(top, ${firstColor}, ${secondColor});
          color: white;
        `;
      }
      if (isFirst) {
        return `
          background-color: ${firstColor};
        `;
      }
      if (isSecond) {
        return `
          background-color: ${secondColor};
          color: white;
        `;
      }
      return '';
    },
    drawInitial() {
      const xScale =  this.xScale;
      d3.select(this.$refs.svg_stratified).selectAll('*').remove();
      // @ts-ignore
      const svg = d3.select(this.$refs.svg_stratified).append('svg')
        .attr('width', '100%')
        .attr('viewBox', `0 0
          ${440}
          ${120}`)
        .append('g')
          .attr('transform', `translate(${0}, ${20})`)
          ;

      
      let set_button = svg.append('rect')
        .attr("class","stratified-set-button")
        .attr("width",40)
        .attr("height",20)
        .attr("x",'10%')
        .attr("y",0)
        .attr('rx',6)
        .attr("fill","lightgrey")
        .on('mouseenter', (d: string) => {
              d3.select(".stratified-slider-text").attr("fill","white")
              d3.select(".stratified-set-button").attr("fill","grey")
            })
            .on('mouseleave', (d: string) => {
              d3.select(".stratified-slider-text").attr("fill","grey")
              d3.select(".stratified-set-button").attr("fill","lightgrey")
            })
            .on('click', (d: string) => this.addSampling =({sampling: 'set'}))
          ; 

      let set_text = svg.append("text")
        .attr("x",'15%')
        .attr("y",15)
        .attr("class",'stratified-slider-text')
        .text("set")
        .style('text-anchor', 'middle')
        .attr("font-size","20px")
        .attr("fill","grey") 
        .on('mouseenter', (d: string) => {
              d3.select(".stratified-slider-text").attr("fill","white")
              d3.select(".stratified-set-button").attr("fill","grey")
            })
            .on('mouseleave', (d: string) => {
              d3.select(".stratified-slider-text").attr("fill","grey")
              d3.select(".stratified-set-button").attr("fill","lightgrey")
            })
            .on('click', (d: string) => this.addSampling =({sampling: 'set'}))
        ;

    },
  },
});
</script>
