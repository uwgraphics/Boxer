<template>
  <div class="card">
    <v-expansion-panels
      v-model="panel"
    >
    <v-expansion-panel>
      <v-expansion-panel-header>
        <div class="handle" style="font-size: 20px;">
          <v-icon
            style="margin-right: 10px;"
            @click="onClose"
          >close</v-icon>
          <span>Histogram ({{ chosenFeature }})</span>
        </div> 
      </v-expansion-panel-header>
      <v-expansion-panel-content>
      <div style="margin: 0px 0px; font-size: 14px; stroke: 'black'; stroke-width:2px; " >
               <v-select v-model="chosenFeature"
                :items="pureCategoricalFeatures"
                label="Categorical"
              ></v-select>
      </div>
      <div style="margin: 0px 0px;  font-size: 14px; stroke: 'black'; stroke-width:2px" >
              <v-select v-model="chosenFeature"
                :items="numericFeatures"
                label="Numeric" 
              ></v-select>
           <v-slider 
            class="numberOfBins"
            v-model="numberOfBins"
            :max="binLimits.max"
            :min="binLimits.min"
            :label="`Preferred number of bins: ${numberOfBins}`"
          ></v-slider>
      <div style="margin: 0px 0px; font-size: 14px; stroke: 'black'; stroke-width:2px; " >
               <v-select v-model="chosenFeature"
                :items="classifiers"
                label="ClassifierPredictions"
              ></v-select>
      </div>
      </div>
      <v-radio-group v-model="chosenFeature">
        <v-radio label="ClassDistribution" value="ClassDistribution"></v-radio>
      </v-radio-group>
      </v-expansion-panel-content>
    </v-expansion-panel>
    </v-expansion-panels>
    <v-switch
      v-model="normalization_switch"
      label="normalize"
      class="ml-8"
    ></v-switch>
    <div ref="svg" />
  </div>
</template>

<script lang="ts">
import Vue from 'vue';
import * as d3 from 'd3';
import { colors } from '../../theme';
import {
  BoxProps,
  Instance,
  SelectionRecord,
} from '../../types';
import {
  instanceById,
  intersection,
} from '../../utils';
import { PredicateSimple, Rule } from '../constraints/types';
import { blankConstraint } from '../constraints/utils';

type Bin = d3.Bin<string, number>;
var VueApp: any = Vue;

export default Vue.extend({
  name: 'Histogram',
  props: {
    boxProps: {
      type: Object as () => BoxProps,
      required: true,
    },
    onClose: {
      type: Function,
      required: true,
    },
  },
  data() {
    const margin = {top: 100, right: 70, bottom: 70, left: 150};
    const width = 1000 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;
    const hover =  {
      type: null as null | Bin,
      count: -1,
    }; 
    const hoverCategory = '';
    const hoverActual = {
      className: '',
    };
    const sorting = '' as ''|'ascending' | 'descending' 
    return {
      svg: '',
      numberOfBins: 10,
      binLimits: {
        max: 30,
        min: 1,
      },
      chosenFeature: 'ClassDistribution',
      selected1: '',
      selected2: '',
      categoryFeatures: [],
      sorting,
      height,
      hoverCategory,
      normalization:'No',
      hover,
      hoverActual,
      width,
      margin,
      panel: [],
      panel2: [],
      panel3: [],
      panel4: [],
      selection1Color: '#18FFFF',
      selection2Color: '#FF4081',
      categoricalFeaturesNum:0,
      numericFeaturesNum:0,
    };
  },
  computed: {
    normalization_switch: {
      set() {
        if (this.normalization == "Yes") {
          this.normalization = "No"
        } else {
          this.normalization = "Yes"
        }
      },
      get() {
        return this.normalization === "Yes";
      }
    },
    normalizationMode() : String {
      var normalizationMode = ""
      switch (this.normalization) {
        case 'Yes' :
          normalizationMode = "Yes"
          break;
        case 'No' :
          normalizationMode = "No"
          break; 
      }
      return normalizationMode;
    },
    classifiers(): string[] {
      const allClassifiers = [...this.boxProps.classifiers];
      const dummyClassifiers = [
        'Oracle',
        'Majority Classifier',
        'Random Classifier',
      ];
      return allClassifiers.filter((c) => !dummyClassifiers.includes(c));
    },
    instances(): string[] {
      return [...this.boxProps.instances];
    },
    bins(): Array<d3.Bin<string, number>> {
      const bins = d3.histogram<string, number>()
        .domain(this.x.domain() as [number, number])
        .thresholds(this.numberOfBins)
        .value((id: string) => {
          const i = instanceById(id);
          const value = i.features[this.chosenFeature];
          return value as number;
        })
        (this.instances);
      return bins;
    },
    binMax(): number {
      const binCounts = this.bins.map((bin) => bin.length);
      const binMax = Math.max(...binCounts);
      return binMax;
    },
    features(): string[] {
      return [...this.boxProps.features];
    },
    featureValues() {
      const instances: any = this.$store.getters.filteredInstances;
      const getInstance = (id: string) => this.$store.getters.instance(id);
      const featureValues: number[] = [...instances].map((id) => getInstance(id).features[this.chosenFeature]);
      return featureValues;
    },
    numericFeatures(): string[] {
      const allFeatures = [...this.boxProps.features];
      const numericTypes = ['interval', 'ratio'];
      const isNumeric = (featureName: string) => {
        const feature = this.$store.getters.feature(featureName);
        return numericTypes.includes(feature.type);
      };
      this.numericFeaturesNum =allFeatures.filter(isNumeric).length 
      let filteredF = allFeatures.filter(isNumeric)
      let finalF = []
      for (var i in filteredF) {
        let cur_dict = { text: filteredF[i], value: filteredF[i] }
        finalF.push(cur_dict)
      }
      return finalF;
    },
    pureCategoricalFeatures() : string[] {
      const categoricalFeatures = [...this.boxProps.features].filter((f) => this.$store.getters.feature(f).type === 'categorical');
      return categoricalFeatures;
    },
    categoricalFeatures(): string[] {
      let categoricalFeatures = [...this.boxProps.features].filter((f) => this.$store.getters.feature(f).type === 'categorical');
      this.categoricalFeaturesNum = categoricalFeatures.length;
      for (var i in categoricalFeatures) {
        this.categoryFeatures.push(categoricalFeatures[i])
      }
      for (var i in this.classifiers) {
        categoricalFeatures.push(this.classifiers[i])
      }
      return categoricalFeatures;
    },
    categories(): string[] {
      if (!this.chosenFeature  || !this.categoricalFeatures.includes(this.chosenFeature)) {
        return [];
      } else {
        var rawData = []
        var nonSort = []
        if (!this.classifiers.includes(this.chosenFeature)) {
          this.$store.getters.feature(this.chosenFeature).categories.forEach((i)=>{
            nonSort.push(i)
            rawData.push(i)
          })
          const bucketedinstances: {
            [category: string]: Set<string>,
          } = {};

          rawData.forEach((category) => {
            bucketedinstances[category] = new Set();
          });

          this.instances.forEach((id) => {
            const category = instanceById(id).features[this.chosenFeature];
            bucketedinstances[category].add(id);
          });
          switch (this.sorting) {
            case '':
              return nonSort;
              break;
            case 'ascending':
              rawData.sort(function(x, y){
                return d3.ascending(bucketedinstances[x].size,bucketedinstances[y].size);
              })
              break;
            case 'descending':
              rawData.sort(function(x, y){
                return (bucketedinstances[y].size - bucketedinstances[x].size);
              })
              break;
          }
          return rawData;
        } else {
          this.classes.forEach((i)=>{
            nonSort.push(i)
            rawData.push(i)
          })
          const bucketedinstances = {}
          this.classes.forEach((c)=>{
            bucketedinstances[c] = new Set();
          })
         
          this.instances.forEach((id) => {
            const predclass = instanceById(id).predictions[this.chosenFeature];
            bucketedinstances[predclass].add(id);
          });
          switch (this.sorting) {
            case '':
              return nonSort;
              break;
            case 'ascending':
              rawData.sort(function(x, y){
                return d3.ascending(bucketedinstances[x].size,bucketedinstances[y].size);
              })
              break;
            case 'descending':
              rawData.sort(function(x, y){
                return (bucketedinstances[y].size - bucketedinstances[x].size);
              })
              break;
          }
          return rawData;
        }
      }
      
    },
    maxByCategory(): number {
      let max = 0;
      if (!this.classifiers.includes(this.chosenFeature)) {
          this.categories.forEach((category) => {
          max = Math.max(max, this.bucketedInstances[category].size);
        });
      } else {
        this.categories.forEach((category) => {
          max = Math.max(max, this.bucketedInstances[category].size);
        });
      }
      return max;
    },
    bucketKeys(): string[] {
      const totalAscending = (c1: string, c2: string) => {
        return this.buckets[c1].size - this.buckets[c2].size;
      };
      const totalDescending = (c1: string, c2: string) => {
        return -totalAscending(c1, c2);
      };

      const predictionKeys = this.classes;
      switch (this.sorting) {
        case 'ascending':
          predictionKeys.sort(totalAscending);
          break;
        case 'descending':
          predictionKeys.sort(totalDescending);
          break;
      }
      return predictionKeys;
    },
    buckets(): {
      [className: string]: Set<string>,
    } {
      const buckets: {
        [className: string]: Set<string>,
      } = {};

      this.classes.forEach((c) => {
        buckets[c] = new Set();
      });

      this.instances.forEach((id) => {
        const i = instanceById(id);
        buckets[i.actual].add(id);
      });
      return buckets;
    },
    bucketedInstances(): {
      [category: string]: Set<string>,
    } {
      if (!this.chosenFeature || !this.categoricalFeatures.includes(this.chosenFeature)) {
        console.log("empty bucketedInstances")
        return {};
      }
      const bucketedInstances: {
        [category: string]: Set<string>,
      } = {};
      if (!this.classifiers.includes(this.chosenFeature)) {
          this.categories.forEach((category) => {
          bucketedInstances[category] = new Set();
        });

        this.instances.forEach((id) => {
          const category = instanceById(id).features[this.chosenFeature];
          if (bucketedInstances[category] === undefined) {
            console.log('undefined category', category);
          }
          bucketedInstances[category].add(id);
        });
        console.log("not empty bucketedInstances",bucketedInstances)
      } else {
        this.categories.forEach((category) => {
          bucketedInstances[category] = new Set();
        });
        this.instances.forEach((id) => {
          const category = instanceById(id).predictions[this.chosenFeature];
          if (bucketedInstances[category] === undefined) {
            console.log('undefined category', category);
          }
          bucketedInstances[category].add(id);
        });
        console.log("bucketedInstances",bucketedInstances)
      }
      return bucketedInstances;
    },
    classes(): string[] {
      return [...this.boxProps.classes];
    },
    focusItemId(): String{return  this.$store.state.focusItemId},
    focusDotEmphasis(): String{return  this.$store.state.focusDotEmphasis},
    selections(): {
      first: SelectionRecord | null,
      second: SelectionRecord | null,
    } {
      return this.$store.state.overlapSelections;
    },
    showActualClassDistribution() :string{
      var showActualClassDistribution = "No"
      switch (this.chosenFeature) {
        case 'ClassDistribution' :
          showActualClassDistribution = "Yes"
          break;
      }
      return showActualClassDistribution;
    },
    x(): d3.ScaleLinear<number, number> {
      const xMin = Math.min(...this.featureValues);
      const xMax = Math.max(...this.featureValues);
      const x = d3.scaleLinear()
        .domain([xMin, xMax])
        .range([0, this.width]);
      return x;
    },
    y(): d3.ScaleLinear<number, number> {
      const yMax = this.binMax;
      const y = d3.scaleLinear()
        .domain([0, this.normalizationMode=="Yes"? 1:1.1 * yMax])
        .range([this.height, 0]);
      return y;
    },
    xCate(): d3.ScaleBand<string> {
      const x = d3.scaleBand<string>()
        .domain(this.categories)
        .range([0, this.width])
        .paddingOuter(0.2)
        .paddingInner(0.3);
      return x;
    },
    yCate(): d3.ScaleLinear<number, number> {
      const yMax =this.maxByCategory;
      const y = d3.scaleLinear()
        .domain([0, this.normalizationMode=="Yes"? 1: 1.1 * yMax])
        .range([this.height, 0]);
      return y;
    },
    xClass(): d3.ScaleBand<string> {
      const x = d3.scaleBand<string>()
        .domain(this.bucketKeys)
        .range([0, this.width])
        .paddingOuter(1)
        .paddingInner(0.3);
      return x;
    },
    yClass(): d3.ScaleLinear<number, number> {
      const bucketSizes = Object.values(this.buckets).map((b: Set<string>) => b.size);
      const yMax = Math.max(...bucketSizes) / this.instances.length;
      const y = d3.scaleLinear()
        .domain([0, this.normalizationMode=="Yes"? 1: 1.1 * yMax])
        .range([this.height, 0]);
      return y;
    },
    saveStatus() {
      return this.$store.state.saveStatus;
    },
    resumeStatus() {
      return this.$store.state.resumeStatus
    },
  },
  watch: {
    resumeStatus() {
      let viewsConfig = this.$store.state.viewsConfig;
      viewsConfig.forEach((view)=>{
        if (view.name == 'Histogram') {
          if (view.config.length > 0) {
            let feature  = view.config[0];
            if (this.pureCategoricalFeatures.includes(feature) 
              || this.numericFeatures.includes(feature) 
              || this.classifiers.includes(feature)) {
                this.chosenFeature = view.config[0]
            }
          }
        }
      })
      this.drawInitial();
    },
    saveStatus() {
      let config = {"name":"Histogram", 
                    "config": [this.chosenFeature]}
      this.$store.dispatch("changedSaveConfig",config)
    },
    chosenFeature() {
      this.drawInitial();
    },
    sorting() {
      this.drawInitial();
    },
    featureValues() {
      this.drawInitial();
    },
    hover() {
      this.drawHover();
    },
    hoverActual() {
      this.drawHover();
    },
    hoverCategory() {
      this.drawHover();
    },
    instances() {
      this.drawInitial();
    },
    numberOfBins() {
      this.drawInitial();
    },
    selections() {
      this.drawInitial();
    },
    focusItemId(){
      this.drawInitial();
    },
    focusDotEmphasis(){
      this.drawInitial();
    },
    normalization() {
      this.drawInitial();
    },
  },
  mounted() {
    let viewsConfig = this.$store.state.viewsConfig;
    viewsConfig.forEach((view)=>{
      if (view.name == 'Histogram') {
        if (view.config.length > 0) {
          let feature  = view.config[0];
          if (this.pureCategoricalFeatures.includes(feature) 
            || this.numericFeatures.includes(feature) 
            || this.classifiers.includes(feature)) {
              this.chosenFeature = view.config[0]
          }
        }
      }
    })
    this.drawInitial();
  },
 methods: {
   clearHover() {
      this.hoverActual = ({ className: '' });
    },
    drawHover() {
      // @ts-ignore
      const chart = d3.select(this.$refs.svg);
      const barstmp = chart.selectAll('.bar');
      const barstmp2 = chart.selectAll('.bar');
      const barsActual = chart.selectAll('.bar');
      const barstmpcircle = chart.selectAll('.bar-circle');
      const barstmp2circle = chart.selectAll('.bar-circle');

      const textSelection1 = chart.selectAll('.text-selection-1');
      const textSelection2 = chart.selectAll('.text-selection-2');

      const barstmprect1 = chart.selectAll('.selection-rect');
      const barstmprect2 = chart.selectAll('.selection-rect');
      const barsActualRect = chart.selectAll('.selection-rect');   

      const yAxisMarkerLine = chart.select('.y-axis-marker-line');
      const yAxisMarkerText = chart.select('.y-axis-marker-text');

      const moveDuration = 500;
      const disappearDuration = 1000;

      var formatDecimal = d3.format(".0f")
      if (this.normalizationMode=="Yes") {
        formatDecimal = d3.format(".3f")
      }
      const { first, second } = this.$store.state.overlapSelections;
      const yText = (instances: Set<string>, selection: Set<string>) => {
        const overlappingInstances = intersection(instances, selection);
        if (!this.categoricalFeatures.includes(this.chosenFeature)) 
          return this.normalizationMode=="Yes"? (overlappingInstances.size / (instances.size)) :(overlappingInstances.size);
         else 
          return this.normalizationMode=="Yes"? (overlappingInstances.size /(instances.size)) : (overlappingInstances.size);
      };

      const hover = this.hover;
      const hoverCategory = this.hoverCategory;
      if (this.showActualClassDistribution == "Yes") {
          if (!this.hoverActual.className) {
            barsActual
              .attr('fill', 'lightgray');
            yAxisMarkerLine
              .attr('stroke-opacity', 0);
            yAxisMarkerText
              .attr('fill-opacity', 0);
            barsActualRect
                .attr("visibility","hidden");   
            textSelection1
                .attr("visibility","hidden");  
            textSelection2
                .attr("visibility","hidden");          
          } else {
            barsActual.data(this.bucketKeys)
              .attr('fill', (d: string) =>
                d === this.hoverActual.className
                  ? 'black'
                  : 'lightgray');
            barsActualRect.data(this.bucketKeys)
                .attr('visibility', (d: string) =>
                d === this.hoverActual.className
                  ?  "visible" : "hidden"); 
              if (!first)  {
                  textSelection1.data(this.bucketKeys)
                    .attr("visibility", "hidden");   
              } else {
                  textSelection1.data(this.bucketKeys)
                    .attr('transform',this.normalizationMode != 'Yes'?
                        `translate(
                      ${ this.xClass(this.hoverActual.className)},
                      ${ this.yClass(this.buckets[this.hoverActual.className].size / this.instances.length) - 45 })`
                        : this.buckets[this.hoverActual.className].size == 0 ?
                        `translate(
                      ${ this.xClass(this.hoverActual.className)},
                      ${ (this.yClass(0)) - 45 })`
                        : `translate(
                      ${ this.xClass(this.hoverActual.className)},
                      ${ (this.yClass(1)) - 45 })`)
                    .style('text-anchor', 'middle')        
                    .attr("visibility", (d: string) =>
                      d === this.hoverActual.className? "visible":"visible")
                    .text( (d: number) => "1st: "+formatDecimal(yText(this.buckets[this.hoverActual.className], first.instances))) ;   
              }
              if (!second) {
                  textSelection2.data(this.bucketKeys)
                  .attr("visibility", "hidden"); 
              } else {
                  textSelection2.data(this.bucketKeys) 
                  .attr('transform',this.normalizationMode != 'Yes'?
                        `translate(
                      ${ this.xClass(this.hoverActual.className)},
                      ${ this.yClass(this.buckets[this.hoverActual.className].size / this.instances.length) - 20 })`
                        : this.buckets[this.hoverActual.className].size == 0 ?
                        `translate(
                      ${ this.xClass(this.hoverActual.className)},
                      ${ (this.yClass(0)) - 20 })`
                        : `translate(
                      ${ this.xClass(this.hoverActual.className)},
                      ${ (this.yClass(1)) - 20 })`)                  
                  .style('text-anchor', 'middle')        
                  .attr("visibility", (d: string) =>
                      d === this.hoverActual.className? "visible":"visible")
                  .text( (d: number) => "2rd: "+formatDecimal(yText(this.buckets[this.hoverActual.className], second.instances))) ;   
              }             
            yAxisMarkerLine
              .attr('stroke-opacity', 1)
              .attr('y1', (this.normalizationMode != 'Yes'? (this.yClass(this.buckets[this.hoverActual.className].size / this.instances.length)) : 
                        this.buckets[this.hoverActual.className].size == 0 ? this.yClass(0) : this.yClass(1)))
              .attr('x2', this.width)
              .attr('y2', (this.normalizationMode != 'Yes'? (this.yClass(this.buckets[this.hoverActual.className].size / this.instances.length)) : 
                        this.buckets[this.hoverActual.className].size == 0 ? this.yClass(0) : this.yClass(1)));
            
            yAxisMarkerText
              .attr('fill-opacity', 1)
              .attr('transform',this.normalizationMode != 'Yes'?
                        `translate(
                      ${ this.xClass(this.hoverActual.className)},
                      ${ this.yClass(this.buckets[this.hoverActual.className].size / this.instances.length) - 70 })`
                        : this.buckets[this.hoverActual.className].size == 0 ?
                        `translate(
                      ${ this.xClass(this.hoverActual.className)},
                      ${ (this.yClass(0)) - 70 })`
                        : `translate(
                      ${ this.xClass(this.hoverActual.className)},
                      ${ (this.yClass(1)) - 70 })`)
              .text("Percentage: "+`${(this.buckets[this.hoverActual.className].size / this.instances.length * 100).toFixed(1)}%`);

          } 
      } else {
          if (!this.categoricalFeatures.includes(this.chosenFeature)) {
            if (!hover) {
              barstmp
                .attr('fill', 'lightgray');
              barstmpcircle
                .attr('fill', 'lightgray');  
              yAxisMarkerLine
                .attr('stroke-opacity', 0);
              yAxisMarkerText
                .text('');
              barstmprect1
                .attr("visibility","hidden"); 
              textSelection1
                .attr("visibility","hidden");  
              textSelection2
                .attr("visibility","hidden");      
            } else {
              barstmp.data(this.bins)
                .attr('fill', (d: Bin) => d.x0 === hover.x0 ? 'black' : 'lightgray');
              barstmpcircle.data(this.bins)
                .attr('fill', (d: Bin) => d.x0 === hover.x0 ? 'black' : 'lightgray');  
              if (!first)  {
                  textSelection1.data(this.bins)
                    .attr("visibility", "hidden");   
              } else {
                  textSelection1.data(this.bins)
                    .attr('transform', this.normalizationMode != "Yes"? `translate(
                  ${(this.x(hover.x0 as number) + this.x(hover.x1 as number)) / 2-0.5*(this.x(hover.x1 as number)-this.x(hover.x0 as number))-50},
                  ${this.y(hover.length) - 45})`
                  :hover.length==0?`translate(
                  ${(this.x(hover.x0 as number) + this.x(hover.x1 as number)) / 2-0.5*(this.x(hover.x1 as number)-this.x(hover.x0 as number))-50},
                  ${this.y(0) - 45})`
                  :
                  `translate(
                  ${(this.x(hover.x0 as number) + this.x(hover.x1 as number)) / 2-0.5*(this.x(hover.x1 as number)-this.x(hover.x0 as number))-50},
                  ${this.y(1) - 45})`
                  )
                    .style('text-anchor', 'middle')        
                    .attr("visibility", (d: Bin) => d.x0 === hover.x0 ? "visible":"visible")
                  .text( ((d: Bin) => "1st: "+formatDecimal(yText(new Set(d), first.instances))));   
              }
              if (!second) {
                  textSelection2.data(this.bins)
                  .attr("visibility", "hidden"); 
              } else {
                  textSelection2.data(this.bins)
                  .attr('transform', this.normalizationMode != "Yes"? `translate(
                  ${(this.x(hover.x0 as number) + this.x(hover.x1 as number)) / 2-0.5*(this.x(hover.x1 as number)-this.x(hover.x0 as number))-50},
                  ${this.y(hover.length) - 20})`
                  :hover.length==0?`translate(
                  ${(this.x(hover.x0 as number) + this.x(hover.x1 as number)) / 2-0.5*(this.x(hover.x1 as number)-this.x(hover.x0 as number))-50},
                  ${this.y(0) - 20})`
                  :
                  `translate(
                  ${(this.x(hover.x0 as number) + this.x(hover.x1 as number)) / 2-0.5*(this.x(hover.x1 as number)-this.x(hover.x0 as number))-50},
                  ${this.y(1) - 20})`
                  )
                  .style('text-anchor', 'middle')        
                  .attr("visibility", (d: Bin) => d.x0 === hover.x0 ? "visible":"visible")
                  .text( ((d: Bin) => "2rd: "+formatDecimal(yText(new Set(d), second.instances)))); 
              }
              barstmprect1.data(this.bins)
                .attr('visibility', (d: Bin) => d.x0 === hover.x0 ? "visible" : "hidden");  
              yAxisMarkerLine
                .attr('stroke-opacity', 1)
                .attr('y1', this.normalizationMode != "Yes"? this.y(hover.length)
                        :hover.length==0?this.y(0): this.y(1))
                .attr('x2', this.width)
                .attr('y2', this.normalizationMode != "Yes"? this.y(hover.length)
                        :hover.length==0?this.y(0): this.y(1));

              yAxisMarkerText
                .attr('transform', this.normalizationMode != "Yes"? `translate(
                  ${(this.x(hover.x0 as number) + this.x(hover.x1 as number)) / 2-0.5*(this.x(hover.x1 as number)-this.x(hover.x0 as number))-50},
                  ${this.y(hover.length) - 70})`
                  :hover.length==0?`translate(
                  ${(this.x(hover.x0 as number) + this.x(hover.x1 as number)) / 2-0.5*(this.x(hover.x1 as number)-this.x(hover.x0 as number))-50},
                  ${this.y(0) - 70})`
                  :
                  `translate(
                  ${(this.x(hover.x0 as number) + this.x(hover.x1 as number)) / 2-0.5*(this.x(hover.x1 as number)-this.x(hover.x0 as number))-50},
                  ${this.y(1) - 70})`
                  )
                .text(this.normalizationMode != "Yes"?"Total: "+ hover.length
                    :hover.length==0?"Total: "+0:"Total: "+1 );

            }
          } else {
              if (!hoverCategory.toString().length ){
                barstmp2   
                  .attr('fill', 'lightgray');
                barstmp2circle     
                  .attr('fill', 'lightgray');  
                yAxisMarkerLine
                  .attr('stroke-opacity', 0);
                yAxisMarkerText
                  .text('');
                barstmprect2
                  .attr("visibility","hidden");  
                textSelection1
                  .attr("visibility","hidden");  
                textSelection2
                  .attr("visibility","hidden");       
            } else {
              barstmp2.data(this.categories)
                .attr('fill', (d: string) => d === hoverCategory ? 'black' : 'lightgray');
              barstmp2circle.data(this.categories)
                .attr('fill', (d: string) => d === hoverCategory ? 'black' : 'lightgray');  
              if (!first)  {
                  textSelection1.data(this.categories)
                    .attr("visibility", "hidden");   
              } else {
                  textSelection1.data(this.categories)
                    .attr('transform', this.normalizationMode != "Yes"?`translate(
                  ${this.xCate.paddingOuter() + (this.xCate(hoverCategory) as number)  },
                  ${this.yCate(this.bucketedInstances[hoverCategory].size) - 45})`
                  :this.bucketedInstances[hoverCategory].size==0?
                  `translate(
                  ${this.xCate.paddingOuter() + (this.xCate(hoverCategory) as number) },
                  ${this.yCate(0) - 45})`
                  :
                  `translate(
                  ${this.xCate.paddingOuter() + (this.xCate(hoverCategory) as number) },
                  ${this.yCate(1) - 45})`
                  )
                    .style('text-anchor', 'middle')        
                    .attr("visibility",(d: string) => d === hoverCategory ? "visible":"visible")
                  .text((d: string) => "1st: "+formatDecimal(yText(this.bucketedInstances[hoverCategory], first.instances)));     
              }
              if (!second) {
                  textSelection2.data(this.categories)
                  .attr("visibility", "hidden"); 
              } else {
                  textSelection2.data(this.categories)
                    .attr('transform', this.normalizationMode != "Yes"?`translate(
                  ${this.xCate.paddingOuter() + (this.xCate(hoverCategory) as number)  },
                  ${this.yCate(this.bucketedInstances[hoverCategory].size) - 20})`
                  :this.bucketedInstances[hoverCategory].size==0?
                  `translate(
                  ${this.xCate.paddingOuter() + (this.xCate(hoverCategory) as number) },
                  ${this.yCate(0) - 20})`
                  :
                  `translate(
                  ${this.xCate.paddingOuter() + (this.xCate(hoverCategory) as number) },
                  ${this.yCate(1) - 20})`
                  )
                    .style('text-anchor', 'middle')        
                    .attr("visibility", (d: string) => d === hoverCategory ?  "visible":"visible")
                  .text((d: string) => "2rd: "+formatDecimal(yText(this.bucketedInstances[hoverCategory], second.instances)));
              }   
              barstmprect2.data(this.categories)
                .attr('visibility', (d: string) => d === hoverCategory ?  "visible" : "hidden");     
              yAxisMarkerLine
                .attr('stroke-opacity', 1)
                .attr('y1', this.normalizationMode != "Yes"?this.yCate(this.bucketedInstances[hoverCategory].size)
                        :this.bucketedInstances[hoverCategory].size==0?this.yCate(0)
                        :this.yCate(1))
                            .attr('x2', this.width)
                .attr('y2', this.normalizationMode != "Yes"? this.yCate(this.bucketedInstances[hoverCategory].size)
                        :this.bucketedInstances[hoverCategory].size==0?
                        this.yCate(0): this.yCate(1) );
              yAxisMarkerText
                .attr('transform', this.normalizationMode != "Yes"?`translate(
                  ${this.xCate.paddingOuter() + (this.xCate(hoverCategory) as number)  },
                  ${this.yCate(this.bucketedInstances[hoverCategory].size) - 70})`
                  :this.bucketedInstances[hoverCategory].size==0?
                  `translate(
                  ${this.xCate.paddingOuter() + (this.xCate(hoverCategory) as number) },
                  ${this.yCate(0) - 70})`
                  :
                  `translate(
                  ${this.xCate.paddingOuter() + (this.xCate(hoverCategory) as number) },
                  ${this.yCate(1) - 70})`
                  )
                .text(this.normalizationMode != "Yes"?"Total: "+this.bucketedInstances[hoverCategory].size: this.bucketedInstances[hoverCategory].size==0?"Total: "+0:"Total: "+1 );
                }
          }
      }
      
      
    },
    drawInitial() {
      // @ts-ignore
      d3.select(this.$refs.svg).selectAll('*').remove();
      // @ts-ignore
      const svg = d3.select(this.$refs.svg).append('svg')
        .attr('width', '100%')
        .attr('viewBox', `0 0
          ${this.width + this.margin.left + this.margin.right}
          ${this.height + this.margin.top + this.margin.bottom}`)
        .append('g')
          .attr('transform', `translate(${this.margin.left}, ${this.margin.top})`);

      const drawBackgroundRect = () => {
        svg.append('rect')
          .attr('width', this.width)
          .attr('height', this.height)
          .attr('fill', 'teal');
      };

      const xClass = this.xClass;
      const yClass= this.yClass;

      this.svg = svg;

      const drawAxes = () => {
        const xAxistmp = (g: any) => g
          .attr('transform', `translate(${0}, ${this.height})`)
          .call(
            d3.axisBottom(this.x)
              .tickSizeOuter(0),
          );
        const xAxistmp2 = (g: any) => g
            .attr('transform', `translate(${0}, ${this.height})`)
            .call(
              d3.axisBottom(this.xCate)
                .tickSizeOuter(0),
            );  
        const yAxistmp =  (g: any) => g
            .call(
              d3.axisLeft(this.y),
            );
        const yAxistmp2 =  (g: any) => g
            .call(
              d3.axisLeft(this.yCate),
            );

        const xAxis = (g: any) => g
          .attr('transform', `translate(${0}, ${this.height})`)
          .call(
            d3.axisBottom(xClass)
              .tickSizeOuter(0),
          );



        const yAxis = (g: any) => g
          .call(d3.axisLeft(yClass)
            .ticks(5)
            .tickFormat(d3.format('.0%')),
          );

        
        if (this.showActualClassDistribution=="Yes") {
          svg.append('g')
            .call(xAxis)
            .attr('font-size', 20)
            ;
          svg.append('g')
            .call(yAxis)
            .attr('font-size', 20);
        }  else {
              if (!this.categoricalFeatures.includes(this.chosenFeature)){
                svg.append('g')
                  .call(xAxistmp)
                svg.append('g')
                  .call(yAxistmp);  
            } else {
              svg.append('g')
                  .call(xAxistmp2)
                  .selectAll('text')
                .attr('transform',  'rotate(45)')
                .attr('text-anchor', 'start');
              svg.append('g')
                  .call(yAxistmp2);   
            }
        }     
        
        svg.selectAll('g.tick')
          .style('font-size', '16px');
      };
      drawAxes();

      const drawTitles = () => {
        svg.append('text')
          .attr('transform', () => {
            const xOffset = this.width / 2;
            const yOffset = this.height + this.margin.bottom * 0.8;
            return `translate(${xOffset}, ${yOffset})`;
          })
          .style('text-anchor', 'middle')
          .style('font-size', '20px')
          .text(this.chosenFeature);

        svg.append('text')
          .attr('transform', 'rotate(-90)')
          .attr('x', -this.height / 2)
          .attr('y', -this.margin.left * 0.9)
          .attr('dy', '1em')
          .style('text-anchor', 'middle')
          .style('font-size', '20px')
          .text(this.normalizationMode=="Yes"?'Percentage of Instances'
              :this.showActualClassDistribution == "Yes"?'Percentage of Instances':'Number of instances');


        var showtext = this.normalizationMode=="Yes"?`Percentage of Instances (${this.chosenFeature})`
            :`Number of Instances (${this.chosenFeature}):`
        if (this.showActualClassDistribution == "Yes") {
          showtext = this.normalizationMode=="Yes"?`Percentage of Instances per Class`
            :`Percentage of Instances per Class`
        }    

        svg.append('text')
          .attr(
            'transform',
            `translate(
              ${-this.margin.left / 2 + this.width / 2},
              ${-this.margin.top * 2 / 3}
            )`,
          )
          .attr('dy', '1em')
          .attr('text-anchor', 'middle')
          .style('font-size', '30px')
          .text(showtext);
      };
      drawTitles();

      const translateCelltmp = (bin: Bin) => {
        const xOffset = this.x(bin.x0 as number) + 1;
        return `translate(${xOffset}, 0)`;
      };
      const translateCelltmp2  = (category: string) => {
          const xOffset = this.xCate(category);
          return `translate(${xOffset}, 0)`;
        };


      const barDescriptiontmp = (bin: Bin): string => {
        return `Instances with feature '${this.chosenFeature}' in range [${bin.x0},${bin.x1})`;
      };
      const barDescriptiontmp2  = (category: string): string => {
        return `Instances with feature '${this.chosenFeature}' equal to '${category}')`;
      };
      
      const cellstmp = svg.selectAll('.celltmp')
        .data(this.bins)
        .join('g')
          .attr('class', 'celltmp')
          .attr('transform', (d: Bin) => translateCelltmp(d))
          .on('mouseenter', (d: Bin) => this.hover = d)
          .on('mouseleave', (d: Bin) => this.hover = null)
          .on('click', (d: Bin) => this.selecttmp(d, 'first'))
          .on('contextmenu', (d: Bin) => this.selecttmp(d, 'second'));
      const  cellstmp2 = svg.selectAll('.celltmp2')
        .data(this.categories)
        .join('g')
          .attr('class', 'celltmp2')
          .attr('transform', (d: string) => translateCelltmp2(d))
          .on('mouseenter', (d: string) => this.hoverCategory = d)
          .on('mouseleave', (d: string) => this.hoverCategory = '')
          .on('click', (d: string) => this.selecttmp2(d, 'first'))
          .on('contextmenu', (d: string) => this.selecttmp2(d, 'second'));
      const cells = svg.selectAll('.cell')
          .data(this.bucketKeys)
          .join('g')
            .attr('class', 'cell')
            .attr('transform', (d: string) => {
              return `translate(${xClass(d)}, ${0})`});    
      

      const x = this.x;
      const y = this.y;
      const xCate = this.xCate;
      const yCate = this.yCate;
      const barWidthtmp = (bin: Bin) => x((bin.x1 as number)) - x((bin.x0 as number));
      const barYOffsettmp = (bin: Bin) => this.normalizationMode!="Yes"? this.y(bin.length) : bin.length==0?this.y(0):this.y(1) ;
      const barHeighttmp = (bin: Bin) => this.height - barYOffsettmp(bin);
      const  barWidthtmp2 = xCate.bandwidth();
      const  barYOffsettmp2  = (category: string) =>  this.normalizationMode!="Yes"? this.yCate(this.bucketedInstances[category].size):this.bucketedInstances[category].size==0?this.yCate(0): this.yCate(1);
      const  barHeighttmp2 = (category: string) => this.height - barYOffsettmp2(category);

      const drawBars = () => {
        if (this.showActualClassDistribution == "Yes") {
          const barWidth = xClass.bandwidth();
          cells.append('rect')
            .attr('class', 'bar')
            .attr('y', (d: string) => this.normalizationMode!="Yes" ? yClass(this.buckets[d].size / this.instances.length)
                                                                  : this.buckets[d].size == 0? yClass(0) : yClass(1))
            .attr('width', barWidth)
            .attr('height', (d: string) => this.height - (this.normalizationMode!="Yes" ? yClass(this.buckets[d].size / this.instances.length)
                                                                  : this.buckets[d].size == 0? yClass(0) : yClass(1)))
            .attr('fill', 'lightgray')
            .attr('stroke', 'black')
            .style('paint-order', 'stroke')
            .on('mouseenter', (d: string) => this.hoverActual = ({ className: d }))
            .on('mouseleave', this.clearHover)
            .on('click', (d: string) => this.select(d, 'first'))
            .on('contextmenu', (d: string) => this.select(d, 'second'));
          cells.append("circle") 
                    .attr('cx', barWidth/2)
                    .attr('cy', d => this.height-15)
                    .attr('r','15px')
                    .style('fill', 'lightgray')
                    .attr('stroke', 'grey')
                    .attr("visibility", (d:string) => {
                      return yClass(this.buckets[d].size / this.instances.length) == 0?"hidden": (this.buckets[d].size / this.instances.length) > 0.05? "hidden":"visible"
                      })
                      .on('click', (d: string) => this.select(d, 'first'))
                    .on('contextmenu', (d: string) => this.select(d, 'second'));
          cells.append('rect')
                .attr('class', 'selection-rect').attr('y', (d: string) =>  (this.normalizationMode!="Yes" ? yClass(this.buckets[d].size / this.instances.length)
                                                                  : this.buckets[d].size == 0? yClass(0) : yClass(1)) -90)
                .attr('x',  -1 * 100)
                  .attr('width', 200)
                  .attr('height', 80)
                  .attr('stroke', 'black')
                  .attr('stroke-width', '1px')
                  .attr('fill', 'white')
                  .attr("visibility","hidden");            
        } else {
              if (!this.categoricalFeatures.includes(this.chosenFeature)){
                cellstmp.append('rect')
                .attr('class', 'bar').attr('y', (d: Bin) => barYOffsettmp(d))
                  .attr('width', (d: Bin) => barWidthtmp(d))
                  .attr('height', (d: Bin) => barHeighttmp(d))
                  .attr('stroke', 'black')
                  .attr('stroke-width', '0.5px')
                  .attr('fill', 'lightgray');
                cellstmp.append("circle")   
                  .attr('class', 'bar-circle').attr('cx',(d: Bin) => barWidthtmp(d) / 2 )
                  .attr('cy', (d: Bin) =>  barWidthtmp(d) / 15 > 15 ? this.height - barWidthtmp(d) / 15 : this.height - 15)
                  .attr('r',(d: Bin) => barWidthtmp(d) / 15 > 15 ? barWidthtmp(d) / 15 : 15)
                  .attr("visibility",(d: Bin) => barHeighttmp(d)/ this.height == 0? "hidden"
                        : barHeighttmp(d)/ this.height>0.1? "hidden":"visible")
                  .style('fill', 'lightgray')    
                  .attr('stroke', 'grey')  

                cellstmp.append('rect')
                .attr('class', 'selection-rect').attr('y', (d: Bin) => barYOffsettmp(d)-90)
                .attr('x', -120)//(d: Bin) => -1 * barWidthtmp(d))
                  .attr('width', 140)//(d: Bin) => 2 * barWidthtmp(d))
                  .attr('height', 80)
                  .attr('stroke', 'black')
                  .attr('stroke-width', '1px')
                  .attr('fill', 'white')
                  .attr("visibility","hidden");    
              } else {
                cellstmp2.append('rect')
                .attr('class', 'bar').attr('y', (d: string) => barYOffsettmp2(d))
                  .attr('width', (d: string) => barWidthtmp2)
                  .attr('height', (d: string) => {
                    return barHeighttmp2(d)})
                  .attr('stroke', 'black')
                  .attr('stroke-width', '0.5px')
                  .attr('fill', 'lightgray');
                cellstmp2.append("circle")   
                  .attr('class', 'bar-circle').attr('cx', (d: string) => barWidthtmp2 / 2)
                  .attr('cy', (d: string) =>  {
                    if (this.normalizationMode=="Yes") {
                      if (barWidthtmp2 / 15 > 15) return this.height - barWidthtmp2 / 15 
                      else return this.height - 15
                    } else {
                      if (barWidthtmp2 / 15 > 15) return yCate(1) - barWidthtmp2 / 15
                      else return  yCate(1) - 15
                    }
                    })
                  .attr('r',(d: string) => barWidthtmp2 / 15 > 15?  barWidthtmp2 / 15 : 15)
                  .attr("visibility",(d: string) => barHeighttmp2(d)/ this.height == 0? "hidden"//:"visible")
                        : barHeighttmp2(d)/ this.height>0.1? "hidden":"visible")
                  .style('fill', 'lightgray')    
                cellstmp2.append('rect')
                .attr('class', 'selection-rect').attr('y', (d: string) => barYOffsettmp2(d)-90)
                .attr('x', (d: string) => -70)
                  .attr('width', 140)
                  .attr('height', 80)
                  .attr('stroke', 'black')
                  .attr('stroke-width', '1px')
                  .attr('fill', 'white')
                  .attr("visibility","hidden");    
              }    
        }
      };
      
      const yAxisMarkerLine = () => {
        if (this.showActualClassDistribution == "Yes") {
          svg.append('line')
          .attr('class', 'y-axis-marker-line')
          .attr('y1', yClass(1))
          .attr('x2', this.width)
          .attr('y2', yClass(1))
          .attr('stroke', 'red')
          .attr('stroke-width', '2px')
          .attr('stroke-opacity', 0)
          .attr('pointer-events', 'none');
        } else {
            if (!this.categoricalFeatures.includes(this.chosenFeature)){
            svg.append('line')
              .attr('class', 'y-axis-marker-line')
              .attr('y1', y(1))
              .attr('x2', this.width)
              .attr('y2', y(1))
              .attr('stroke', 'red')
              .attr('stroke-width', '2px')
              .attr('stroke-opacity', 0)
              .attr('pointer-events', 'none');
          } else {
            svg.append('line')
              .attr('class', 'y-axis-marker-line')
              .attr('y1', yCate(1))
              .attr('x2', this.width)
              .attr('y2', yCate(1))
              .attr('stroke', 'red')
              .attr('stroke-width', '2px')
              .attr('stroke-opacity', 0)
              .attr('pointer-events', 'none');
          }
        }
         
      };
      const yAxisMarkerText = () => {
        svg.append('text')
          .attr('class', 'y-axis-marker-text')
          .attr('text-anchor', 'middle')
          .attr('font-size', 20)
          .attr('pointer-events', 'none');
      };
      yAxisMarkerLine();
      yAxisMarkerText();
      drawBars();
      this.drawHover();
      this.drawSelections();
    },
   
    drawSelections() {
      // @ts-ignore

      const { first, second } = this.selections;
      var formatDecimal = d3.format(".0f")
      if (this.normalizationMode=="Yes") {
        formatDecimal = d3.format(".3f")
      }

      const selections = [first, second];


      const rightYOffset = (instances: Set<string>, selection: Set<string>) => {
        const overlappingInstances = intersection(instances, selection);
        return this.normalizationMode=="Yes"? this.yClass(overlappingInstances.size / (instances.size)) : this.yClass(overlappingInstances.size / this.instances.length)
      };
      const rightHeight = (instances: Set<string>, selection: Set<string>) => {
        return this.height - rightYOffset(instances, selection);
      };
      const yOffset = (instances: Set<string>, selection: Set<string>) => {
        const overlappingInstances = intersection(instances, selection);
        if (!this.categoricalFeatures.includes(this.chosenFeature)) 
          return this.normalizationMode=="Yes"? this.y(overlappingInstances.size / (instances.size)) : this.y(overlappingInstances.size);
         else 
          return this.normalizationMode=="Yes"? this.yCate(overlappingInstances.size /(instances.size)) : this.yCate(overlappingInstances.size);
      };
      const height = (instances: Set<string>, selection: Set<string>) => {
          return this.height - yOffset(instances, selection);
      };
      const yText = (instances: Set<string>, selection: Set<string>) => {
        const overlappingInstances = intersection(instances, selection);
        if (!this.categoricalFeatures.includes(this.chosenFeature)) 
          return this.normalizationMode=="Yes"? (overlappingInstances.size / (instances.size)) :(overlappingInstances.size);
         else 
          return this.normalizationMode=="Yes"? (overlappingInstances.size /(instances.size)) : (overlappingInstances.size);
      };
      const hasFocusItem = (instances: Set<string>, selection: Set<string>) => {
        const overlappingInstances = intersection(instances, selection);
        for (const id of overlappingInstances) {
          if(this.$store.state.focusItemId === id) return true
        }
        return false
      }


      selections.forEach((cur_selection, idx)=>{
        if (!cur_selection) {
          this.svg.selectAll('selection-rect-'+idx).attr('height', '0');
          this.svg.selectAll('selection-circle-'+idx).attr("visibility","hidden");
        } else {
          if (this.showActualClassDistribution == 'Yes') {
            let x = this.xClass;
            let barWidth = x.bandwidth();
            let selectionBarWidth = barWidth / 8;
            this.bucketKeys.forEach((d)=>{
              let selection_attributes = {
                barCells : this.svg,
                x : x(d) + barWidth / 2 + (idx-1) * selectionBarWidth ,
                y : rightYOffset(this.buckets[d], cur_selection.instances),
                width : selectionBarWidth,
                height :rightHeight(this.buckets[d], cur_selection.instances),
                r  : selectionBarWidth / 2,
                color : idx == 0? this.selection1Color : this.selection2Color,
                circle_visibility : rightHeight(this.buckets[d], cur_selection.instances) == 0?"hidden"
                    :rightHeight(this.buckets[d], cur_selection.instances) / this.height >0.05?"hidden":"visible",
                cx : x(d) + barWidth / 2  + (idx - 1/2) * selectionBarWidth,
                cy : this.height - selectionBarWidth / 2,
                selection_type: idx,
                focused: hasFocusItem(this.buckets[d], cur_selection.instances),
                view_name : this.name
              }
              this.$store.dispatch('drawSelections',selection_attributes)
            })
          } else {
            if (!this.categoricalFeatures.includes(this.chosenFeature)) {
              let x = (bin: Bin) => {
                const xOffset = this.x(bin.x0 as number) + 1;
                return xOffset
              };
              const barWidthtmp = (bin: Bin) => this.x((bin.x1 as number)) - this.x((bin.x0 as number));
              const selectionBarWidth = (d: Bin) => barWidthtmp(d) / 8;

              this.bins.forEach((d)=>{
                  let selection_attributes = {
                    barCells : this.svg,
                    x : barWidthtmp(d) / 2 + (idx-1) *  selectionBarWidth(d) + x(d),
                    y : yOffset(new Set(d), cur_selection.instances),
                    width : selectionBarWidth(d),
                    height :height(new Set(d), cur_selection.instances),
                    r  : selectionBarWidth(d) / 2,
                    color : idx == 0? this.selection1Color : this.selection2Color,
                    circle_visibility : isNaN(parseInt(formatDecimal(yText(new Set(d), cur_selection.instances)))) ?  "hidden"  
                          : height(new Set(d), cur_selection.instances)== 0?"hidden"
                          : height(new Set(d), cur_selection.instances) / this.height>0.05?"hidden":"visible",
                    cx : x(d) + barWidthtmp(d) / 2   + (idx - 1/2) * selectionBarWidth(d),
                    cy : this.height - selectionBarWidth(d) / 2,
                    selection_type: idx,
                    focused: hasFocusItem(new Set(d), cur_selection.instances),
                    view_name : this.name
                  }
                  this.$store.dispatch('drawSelections',selection_attributes)
              })
            } else {
              this.categories.forEach((d)=>{
                  let  barWidthtmp = this.xCate.bandwidth();
                  let selectionBarWidth = barWidthtmp / 8;
                  let x = this.xCate;
                  let selection_attributes = {
                    barCells : this.svg,
                    x : barWidthtmp / 2 + (idx-1) *  selectionBarWidth + x(d),
                    y :  yOffset(this.bucketedInstances[d], cur_selection.instances),
                    width : selectionBarWidth,
                    height :height(this.bucketedInstances[d], cur_selection.instances),
                    r  : selectionBarWidth / 2,
                    color : idx == 0? this.selection1Color : this.selection2Color,
                    circle_visibility : isNaN(parseInt(formatDecimal(yText(this.bucketedInstances[d], cur_selection.instances)))) ? "hidden"
                            : height(this.bucketedInstances[d], cur_selection.instances) == 0?"hidden"
                            : height(this.bucketedInstances[d], cur_selection.instances) / this.height>0.05?"hidden":"visible",
                    cx : x(d) + barWidthtmp / 2  + (idx - 1/2) * selectionBarWidth,
                    cy : this.height - selectionBarWidth / 2,
                    selection_type: idx,
                    focused: hasFocusItem(this.bucketedInstances[d], cur_selection.instances),
                    view_name : this.name
                  }
                  this.$store.dispatch('drawSelections',selection_attributes)
              })
            }
          }
        }
      })
    },
    selecttmp(
      d: Bin,
      whichOverlap: 'first' | 'second',
    ) {
      d3.event.preventDefault();
      d3.event.stopPropagation();
      const instances = new Set(d);
      const description = `Instances which have "${this.chosenFeature}" between ${d.x0} and ${d.x1}`;
      // lower bound is inclusive
      const constraintLowerBound = blankConstraint();
      // negation of LT means feature is greater then or equal to
      constraintLowerBound.rule = Rule.FEATURE_LT;
      constraintLowerBound.negation = true;
      constraintLowerBound.value = String(d.x0);
      // upper bound is exclusive, TODO: except for the last bin
      const constraintUpperBound = blankConstraint();
      constraintUpperBound.rule = Rule.FEATURE_LT;
      constraintUpperBound.value = String(d.x1);
      const predicate: PredicateSimple = {
        type: 'simple',
        constraints: [constraintLowerBound, constraintUpperBound],
        metric : []
      };
      const payload = {
        description,
        instances,
        predicate,
      };
      this.$store.dispatch('prependToSelectionHistory', payload);
      this.$store.dispatch('changedMostRecentSelection', whichOverlap);
    },
    selecttmp2(
      d: string,
      whichOverlap: 'first' | 'second',
    ) {
      d3.event.preventDefault();
      d3.event.stopPropagation();

      const constraint = blankConstraint();
      constraint.rule = Rule.FEATURE_EQ;
      constraint.feature = this.chosenFeature;
      constraint.value = d;

      const instances = this.bucketedInstances[d];
      const description = `Instances with feature '${this.chosenFeature}' equal to '${d}')`;
      const predicate: PredicateSimple = {
        type: 'simple',
        constraints: [constraint],
        metric:[],
      };
      const payload = {
        description,
        instances,
        predicate,
      };

      this.$store.dispatch('prependToSelectionHistory', payload);
      this.$store.dispatch('changedMostRecentSelection', whichOverlap);
    },
    select(
      className: string,
      whichOverlap: 'first' | 'second',
    ) {

      d3.event.preventDefault();
      d3.event.stopPropagation();

      const constraint = blankConstraint();
      constraint.rule = Rule.ACTUAL;
      constraint.target = className;

      const instances = this.buckets[className];
      const description = `Instances of class ${className}`;
      const predicate: PredicateSimple = {
        type: 'simple',
        constraints: [constraint],
        metric: [],
      };
      const payload = {
        description,
        instances,
        predicate,
      };
      this.$store.dispatch('prependToSelectionHistory', payload);
      this.$store.dispatch('changedMostRecentSelection', whichOverlap);
    },
  },
});
</script>

<style scoped>
.card {
  background-color: white;
}
</style>
