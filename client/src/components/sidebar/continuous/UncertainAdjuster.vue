<template>
  <div class="card">

  <v-expansion-panels
    v-model="panel"
    multiple
  >
  <label>BandWidth Select </label>
  <multiselect v-model="value" tag-placeholder="Add this as new bandWidth" label="name" track-by="name" 
              :options="options" :multiple="true" :taggable="true" @tag="addTag"></multiselect>


  </v-expansion-panels>
  <div ref="svg" />
    </div>
</template>

<script lang="ts">
import Vue from 'vue';
import * as d3 from 'd3';


import {
  modelSelectionRecord,
  ThresholdWithClassifier,
} from '../../../types';

export default Vue.extend({
  name: 'UncertainAdjuster',
  data() {
    const sliderRange = {
      type: '' as 'from' | 'to',
      classifier: '',
      value: 0,
    }
    const classifierThresholdDict = this.$store.state.classifierThresholdDict;
    const curAddedBandWidthClassifier = {
      classifier: '',
      left_range: 0.45,
      right_range: 0.55,
    };
    const origin_value = Object.keys(this.$store.state.classifierThresholdDict).map((c)=> {
      return {'name': c + '(' + ((this.$store.state.classifierThresholdDict[c] / 100 - 0.05) < 0 ? 0 : this.$store.state.classifierThresholdDict[c] / 100 - 0.05).toFixed(2) 
                + ',' + ((this.$store.state.classifierThresholdDict[c] / 100 + 0.05) > 1 ? 1 : this.$store.state.classifierThresholdDict[c] / 100 + 0.05).toFixed(2) + ')'}
    });
    const value = Object.keys(this.$store.state.classifierThresholdDict).map((c)=> {
      return {'name': c + '(' + ((this.$store.state.classifierThresholdDict[c] / 100 - 0.05) < 0 ? 0 : this.$store.state.classifierThresholdDict[c] / 100 - 0.05).toFixed(2) 
                + ',' + ((this.$store.state.classifierThresholdDict[c] / 100 + 0.05) > 1 ? 1 : this.$store.state.classifierThresholdDict[c] / 100 + 0.05).toFixed(2) + ')'}
    });
    const options = Object.keys(this.$store.state.classifierThresholdDict).map((c)=> {
      return {'name': c + '(' + ((this.$store.state.classifierThresholdDict[c] / 100 - 0.05) < 0 ? 0 : this.$store.state.classifierThresholdDict[c] / 100 - 0.05).toFixed(2) 
                + ',' + ((this.$store.state.classifierThresholdDict[c] / 100 + 0.05) > 1 ? 1 : this.$store.state.classifierThresholdDict[c] / 100 + 0.05).toFixed(2) + ')'}
    });
    return {
      classifierThresholdDict,
      sliderRange,
      thresholdRange: {},      
      panel: [] as string[],
      threshold: 0,
      curAddedBandWidthClassifier,
      value,
      options,
      origin_value,
      added_value: [],
    };
  },
  computed: {
    resumedBandwidths() {
      return this.$store.state.resumedBandwidths;
    },
    outerBandWidth() {
      return this.$store.state.outerBandWidth;
    },
    addedBandWidthClassifiers() {
      return this.$store.state.addedBandWidthClassifiers;
    },
    classifierFilters() {
      return this.$store.state.filters.classifier;
    },
    curAddedThresholdClassifier(): {} {
      return this.$store.state.curAddedThresholdClassifier;
    },
    thresholdClassifierNameList(): string[]{
      return this.$store.getters.thresholdClassifierNameList
    },
    classifierThresholdList(): ThresholdWithClassifier[] {
      return this.$store.getters.classifierThresholdList
    },
  
    xScale(): d3.ScaleLinear<number, number> {
      const xScale = d3.scaleLinear()
          .domain([0, 400])
          .range([10, 410])
          .clamp(true);
      return xScale;      
    },
    resumeStatus() {
      return this.$store.state.resumeStatus
    },
  },
  watch: {
    resumeStatus() {
      this.drawResumedBandwidths();
      this.updateValues();
    },
    outerBandWidth() {
      this.drawOuterRanges();
      this.updateValues();
    },
    classifierFilters() {
      const filteredClassifier = [...this.classifierFilters.set]
      this.value = []
      this.options = []

      this.origin_value.forEach((c)=>{
        let d  = c.name
        let classifier = d.split('(')[0]
        if (!filteredClassifier.includes(classifier)) {
          this.value.push(c)
          this.options.push(c)
        }
      })
      this.added_value.forEach((c)=>{
        let d  = c.name
        let classifier = d.split('(')[0]
        if (!filteredClassifier.includes(classifier)) {
          this.value.push(c)
          this.options.push(c)
        }
      })
    },
    curAddedThresholdClassifier() {
      const filteredClassifier = [...this.classifierFilters.set]
      let threshold = parseFloat(this.curAddedThresholdClassifier.threshold);
      let left_range = ((threshold - 0.05) < 0 ? 0: threshold - 0.05).toFixed(2)
      let right_range = ((threshold + 0.05) > 1 ? 1 : threshold + 0.05).toFixed(2)
      this.options = []
      this.value = []
      this.added_value.push({name: this.curAddedThresholdClassifier.classifier + '(' + left_range + ',' + right_range + ')'})
      
      this.origin_value.forEach((c)=>{
        let d  = c.name
        let classifier = d.split('(')[0]
        if (!filteredClassifier.includes(classifier)) {
          this.value.push(c)
          this.options.push(c)
        }
      })
      this.added_value.forEach((c)=>{
        let d  = c.name
        let classifier = d.split('(')[0]
        if (!filteredClassifier.includes(classifier)) {
          this.value.push(c)
          this.options.push(c)
        }
      })
    },
    sliderRange() {
      this.drawUpdateRanges();
      this.updateValues();
    },
    classifierThresholdDict() {
      this.drawInitial();
    },
    thresholdClassifierNameList() {
      this.drawInitial();
      this.updateValues();
    },
    curAddedBandWidthClassifier() {
      const filteredClassifier = [...this.classifierFilters.set]
      this.options = []
      this.value = []
      this.added_value.push({name: this.curAddedBandWidthClassifier.classifier + '(' + this.curAddedBandWidthClassifier.left_range + ',' + this.curAddedBandWidthClassifier.right_range + ')'})  
      this.origin_value.forEach((c)=>{
        let d  = c.name
        let classifier = d.split('(')[0]
        if (!filteredClassifier.includes(classifier)) {
          this.value.push(c)
          this.options.push(c)
        }
      })
      this.added_value.forEach((c)=>{
        let d  = c.name
        let classifier = d.split('(')[0]
        if (!filteredClassifier.includes(classifier)) {
          this.value.push(c)
          this.options.push(c)
        }
      })
    },
    value() {
      let pre_values = this.addedBandWidthClassifiers.map(function(c){return c.name})
      let cur_values = this.value.map(function(c){return c.name})
      let deleted_values = []
      let new_added_values = []

      pre_values.forEach((c)=>{
        if (!cur_values.includes(c)) {
          deleted_values.push(c)
        }
      })
      this.added_value.forEach((c)=> {
        if (!deleted_values.includes(c.name)) {
          new_added_values.push(c)
        }
      })
      this.added_value = new_added_values;
      this.$store.dispatch('changedAddedBandWidthClassifiers', this.value)
    },
  },
  mounted() {
     this.drawInitial();
    if (this.resumeStatus > 0) {
      this.drawResumedBandwidths();
      this.updateValues();
    }
  },

  methods: {
    addTag (newTag) {
      const tag = {
        name: newTag,
      }
      this.options.push(tag)
      this.value.push(tag)
    },
    updateValues() {
      const filteredClassifier = [...this.classifierFilters.set]
      this.options  = []
      this.value = []
      // update original values
      this.origin_value = [];
      for (let key in this.thresholdRange) {
        this.origin_value.push({'name': key  + '(' + this.thresholdRange[key].left_range.toFixed(2) + ',' + this.thresholdRange[key].right_range.toFixed(2) + ')'})
      }


      this.origin_value.forEach((c)=>{
        let d  = c.name
        let classifier = d.split('(')[0]
        if (!filteredClassifier.includes(classifier)) {
          this.value.push(c)
          this.options.push(c)
        }
      })
      this.added_value.forEach((c)=>{
        let d  = c.name
        let classifier = d.split('(')[0]
        if (!filteredClassifier.includes(classifier)) {
          this.value.push(c)
          this.options.push(c)
        }
      })
    },
    drawResumedBandwidths() {
      const classifiers = Object.keys(this.classifierThresholdDict)
      const chart = d3.select(this.$refs.svg);
      let tmp = {}
      classifiers.forEach((c)=>{
        tmp[c] = {
            name:c,
            threshold: Object.keys( this.classifierThresholdDict).includes(c)? this.classifierThresholdDict[c] : 0,
            left_range:  this.resumedBandwidths[c].left_range,
            right_range:  this.resumedBandwidths[c].right_range
        }
        chart.select('.slider-circle-time-from'+c).attr('transform', 'translate(' + this.xScale(tmp[c].left_range * 400) + ', 60)') 
        chart.select('.slider-circle-time-to'+c).attr('transform', 'translate(' + this.xScale(tmp[c].right_range * 400) + ', 60)') 

        chart.select(".range-text-"+c).text((d:string)=>"("+(tmp[c].left_range) +", "+(tmp[c].right_range ) +")")
        
        this.$store.dispatch("changedBandWidthClassifier",c);
      })
      this.thresholdRange = tmp
      this.$store.dispatch("changedclassifierBandWidthDict",tmp);
    },
    drawOuterRanges() {
      const classifier = this.outerBandWidth.classifier;
      const from = this.outerBandWidth.left_range * 400;
      const to = this.outerBandWidth.right_range * 400;
      const chart = d3.select(this.$refs.svg);
      const range_text = chart.select(".range-text-"+classifier)

      let tmp = {}

      for(let c in this.thresholdRange) {
        tmp[c] = this.thresholdRange[c]
      }

      tmp[classifier].left_range  = this.outerBandWidth.left_range;
      tmp[classifier].right_range =  this.outerBandWidth.right_range;

      this.thresholdRange = tmp

      
      chart.select('.slider-circle-time-from'+classifier).attr('transform', 'translate(' + this.xScale(from) + ', 60)') 
      chart.select('.slider-circle-time-to'+classifier).attr('transform', 'translate(' + this.xScale(to) + ', 60)') 

      range_text.text((d:string)=>"("+(this.thresholdRange[classifier].left_range).toFixed(2) +", "+(this.thresholdRange[classifier].right_range ).toFixed(2) +")")
      this.$store.dispatch("changedclassifierBandWidthDict",tmp);
      this.$store.dispatch("changedBandWidthClassifier",classifier);

    },
    drawUpdateRanges() {
      const type = this.sliderRange.type;
      const classifier = this.sliderRange.classifier;
      const value = this.sliderRange.value;
      let tmp = {}

      for(let c in this.thresholdRange) {
        tmp[c] = this.thresholdRange[c]
      }

      const chart = d3.select(this.$refs.svg);
      const range = chart.select('.slider-circle-time-'+type+classifier)
      const range_text = chart.select(".range-text-"+classifier)

      if (type == "from"){
        var cur_from = value / 400
        tmp[classifier].left_range = cur_from < 0 ? 0 : cur_from;
      } else {
        var cur_to = value/ 400
        tmp[classifier].right_range = cur_to > 1 ? 1 : cur_to;
      }

      this.thresholdRange = tmp

      range.attr('transform', 'translate(' + this.xScale(value) + ', 60)') 
      range_text.text((d:string)=>"("+(this.thresholdRange[classifier].left_range).toFixed(2) +", "+(this.thresholdRange[classifier].right_range ).toFixed(2) +")")
      this.$store.dispatch("changedclassifierBandWidthDict",tmp);
      this.$store.dispatch("changedBandWidthClassifier",classifier);
     },

    drawInitial() {
      d3.select(this.$refs.svg).selectAll('*').remove();
      // @ts-ignore

      const classifiers = Object.keys(this.classifierThresholdDict)

      const svg = d3.select(this.$refs.svg).append('svg')
        .attr('width', '100%')
        .attr('viewBox', `0 0
          ${440}
          ${120*classifiers.length+20}`)
        .append('g')
          .attr('transform', `translate(${0}, ${0})`);


      svg.append("rect")
      .attr("class","rect")
        .attr("width",430)
        .attr("height",120*classifiers.length)
        .attr("x",0)
        .attr("y",10)
        .attr("fill","white")
        .attr("stroke","lightgrey")
        .attr("stroke-width","2px")

      var sqrt3 = Math.sqrt(3);

      var triangleRight = {
        draw: function (context, size) {
          var x = -Math.sqrt(size / (sqrt3 * 3));
          context.moveTo(-x * 2, 0);
          context.lineTo(x, -sqrt3 * x);
          context.lineTo(x, sqrt3 * x);
          context.closePath();
        }
      };

      var triangleLeft = {
        draw: function (context, size) {
          var x = -Math.sqrt(size / (sqrt3 * 3));
          context.moveTo(x * 2, 0);
          context.lineTo(-x, -sqrt3 * x);
          context.lineTo(-x, sqrt3 * x);
          context.closePath();
        }
      };

      let leftTrgl = d3.symbol().type(triangleLeft)
        .size(180);
      let rightTrgl = d3.symbol().type(triangleRight)
        .size(180);

      if (Object.keys(this.thresholdRange).length == 0) {
        const thresholdRange: {
          [classifier: string]: {
            name: String,
            threshold: Number,
            left_range: Number,
            right_range: Number,
          },
        } = {};
        classifiers.forEach((c) => {
          thresholdRange[c] = {
            name:c,
            threshold: Object.keys( this.classifierThresholdDict).includes(c)? this.classifierThresholdDict[c] : 0,
            left_range:  !Object.keys( this.classifierThresholdDict).includes(c)? 0 : this.classifierThresholdDict[c] / 100 - 0.05 < 0 ? 0 : this.classifierThresholdDict[c] / 100 - 0.05,
            right_range: !Object.keys( this.classifierThresholdDict).includes(c)? 0 : this.classifierThresholdDict[c] / 100 + 0.05 > 1 ? 1 : this.classifierThresholdDict[c] / 100 + 0.05,
          };
        });
        this.thresholdRange = thresholdRange
        this.$store.dispatch("changedclassifierBandWidthDict",this.thresholdRange)
        this.$store.dispatch("changedBandWidthClassifier",'');
      }

      //check whether align 
      for (let c in this.thresholdRange){
        let classifier =this.thresholdRange[c].name
        let threshold = this.thresholdRange[c].threshold/100
        let left_range = this.thresholdRange[c].left_range
        let right_range = this.thresholdRange[c].right_range
        if (threshold == this.classifierThresholdDict[classifier]/100){
          continue
        }
        let left_diff = threshold - left_range
        let right_diff = right_range - threshold
        delete this.thresholdRange[c];
        this.thresholdRange[classifier] = {
          name:classifier,
          threshold: this.classifierThresholdDict[classifier],
          left_range:  (this.classifierThresholdDict[classifier]/100 - left_diff) < 0 ? 0 : (this.classifierThresholdDict[classifier]/100 - left_diff),
          right_range: (this.classifierThresholdDict[classifier] / 100 + right_diff) > 1 ? 1 : (this.classifierThresholdDict[classifier] / 100 + right_diff) ,
        }
        this.$store.dispatch("changedclassifierBandWidthDict",this.thresholdRange);
        this.$store.dispatch("changedBandWidthClassifier",'');
      }

      const thresholdRange = this.thresholdRange;
      const xScale =  this.xScale;

      const rangeSliders =  svg.append("g").selectAll("g")
            .data(classifiers)
            .enter().append("g")
              .attr("transform", function(d,i) { 
                return "translate(0," + (i * 120) +")"; })

        let titles = rangeSliders.append("text")
          .attr("transform",   "translate(30,"  +"30)")
          .attr("class",(d)=>"slider-text"+d)
          .text((d:string)=>d)
          .attr("x",5)
          .attr("font-size","22px")
          .attr("fill","grey")


        let borders = rangeSliders.append("line")
          .attr("transform",   "translate(0,"  +"110)")
          .attr("class","range-border")
          .style("stroke", "lightgrey")
          .style("stroke-opacity", "1")
          .style("stroke-width", "3")
          .attr('x1', 0)
          .attr('x2', 430)
          .attr('y1', 0)
          .attr('y2', 0)
          .attr("visibility",(d:string)=> d==classifiers[classifiers.length-1]?"hidden":"visible")
                

        let slider = rangeSliders.append('line')
        .attr("transform",   "translate(0,"  +"60)")
          .attr('class', 'track')
          .style("stroke", "#777")
          .style("stroke-opacity", "1")
          .style("stroke-width", "5")
          .attr('x1', 10)
          .attr('x2', 410)
          .attr('y1', 0)
          .attr('y2', 0)

        let head1 = rangeSliders.append('path')
          .attr('d', leftTrgl)
          .style('fill', 'red')
          .style('stroke', 'none')
          .attr('class',(d:string)=>'slider-circle-time-from'+d)
          .attr('transform', function(d:string){
            let dis =(thresholdRange[d].left_range * 400)
            return 'translate('+xScale(dis)+',60)'
          })
          .call(d3.drag()
            .on('start.interrupt', function () {
              head1.interrupt();
            })
            .on('start drag',  
            (d:string)=>this.sliderRange =({type:"from", classifier:d, value: xScale.invert(d3.event.x)})//
            ))
            ;

        let head2 = rangeSliders.append('path')
          .attr('d', rightTrgl)
          .style('fill', 'green')
          .style('stroke', 'none')
          .attr('class',(d:string)=>'slider-circle-time-to'+d)
          .attr('transform',function(d:string){
            let dis =(thresholdRange[d].right_range * 400)
            return 'translate('+xScale(dis)+',60)'
          })
          .call(d3.drag()
            .on('start.interrupt', function () {
              head2.interrupt();
            })
            .on('start drag',
            (d:string)=>this.sliderRange =({type:"to", classifier:d, value: xScale.invert(d3.event.x)})//
            ))

        let rangeText = rangeSliders.append("text")
        .attr("transform",   "translate(10,"  +"100)")
          .attr("class",(d:string)=>"range-text-"+d)
          .text((d:string)=>"("+(this.thresholdRange[d].left_range).toFixed(2) +", "+(this.thresholdRange[d].right_range ).toFixed(2) +")")
          .attr("font-size","18px")
          .attr("fill","grey") 

        let addButton = rangeSliders.append("rect")
          .attr("width",40)
          .attr("height",20)
          .attr("transform",   "translate(120,"  +"82)")
            .attr("class",(d:string)=>"add-bandwidth-"+d)
            .attr("fill","lightgrey") 
          
        let addText = rangeSliders.append("text")
          .attr("transform",   "translate(125,"  +"100)")
            .attr("class",(d:string)=>"add-bandwidth-set-"+d)
            .text("add")
            .attr("font-size","18px")
            .attr("fill","grey") 
            .on('mouseenter', (d: string) => {
              d3.select(".add-bandwidth-set-"+d).attr("fill","white")
              d3.select(".add-bandwidth-"+d).attr("fill","grey")
            })
            .on('mouseleave', (d: string) => {
              d3.select(".add-bandwidth-set-"+d).attr("fill","grey")
              d3.select(".add-bandwidth-"+d).attr("fill","lightgrey")
            })
            .on('click', (d: string) => this.curAddedBandWidthClassifier =({classifier:d, left_range: this.thresholdRange[d].left_range.toFixed(2), right_range: this.thresholdRange[d].right_range.toFixed(2)}))

    },
  },
});
</script>

