<template>
  <div class="card">
    <v-expansion-panels
      v-model="panel"
    >
      <v-expansion-panel>
        <v-expansion-panel-header>
          <div class="handle" style="font-size: 20px;">
            <v-icon
              style="margin-right: 4px;"
              @click="onClose"
            >close</v-icon>
            <span>Metrics Table</span>
          </div>
        </v-expansion-panel-header>
        <v-expansion-panel-content>
          <div style="margin: 0px 30px;">
            <v-radio-group v-model="display_mode" label="Display Mode">
              <v-radio label="overall mode " value="overall"></v-radio>
              <v-radio label="uncertain mode" value="uncertain"></v-radio>
            </v-radio-group>
          </div>
          <div style="margin: 0px 30px;">
          <v-radio-group v-model="weightedPerformance" label="Performance Type">
            <v-radio label="normal" value="normal"></v-radio>
            <v-radio label="weighted" value="weighted"></v-radio>
          </v-radio-group>
        </div>
        </v-expansion-panel-content>
      </v-expansion-panel>
    </v-expansion-panels>
    <v-data-table
      :headers="headers"
      :items="metrics"
      :datasetType="datasetType"
      :continuous_dict="continuous_dict"
      class="elevation-1"
      multi-sort
      :sort-by="sortby"
    >
    <template v-slot:body="{ items }">
      <tbody>
        <tr
          v-for="item in items"
          :key="item.classifier"
        >
          <td>{{ item.classifier }}</td>
          <td v-if="datasetType == 'continuous'  && display_mode == 'overall'" class="column0">{{ `${continuous_dict[item.classifier].cur_threshold.toFixed(2)}` }}</td>
          <td v-if="datasetType == 'continuous'  && display_mode == 'uncertain'" class="column0">{{ `${continuous_dict[item.classifier].cur_uncertain}` }}</td>
          <td v-if=" datasetType != 'continuous' " class="column1"> {{ `${item.metrics.accuracy.toFixed(3)}` }}</td>
          <td v-if="datasetType == 'continuous' && display_mode != 'uncertain' " class="column1">{{ `${continuous_dict[item.classifier].accuracy.toFixed(3)}` }}</td> 
          <td v-if="datasetType == 'continuous' && display_mode == 'uncertain' " class="column1">{{ `${continuous_dict[item.classifier].m_accuracy.toFixed(3)}` }}</td> 

          <td v-if="datasetType != 'continuous'" class="column2">{{ `${item.metrics.mcc.average.toFixed(3)}` }}</td>
          <td v-if="datasetType == 'continuous' && display_mode != 'uncertain'" class="column2">{{ `${continuous_dict[item.classifier].mcc.toFixed(3)}` }}</td> 
          <td v-if="datasetType == 'continuous' && display_mode == 'uncertain'" class="column2">{{ `${continuous_dict[item.classifier].m_mcc.toFixed(3)}` }}</td> 

          <td v-if="classNumber > 2" class="column3">{{ `${item.metrics.microf1.average.toFixed(3)}` }}</td>
          <td v-if="classNumber > 2" class="column4">{{ `${item.metrics.macrof1.average.toFixed(3)}` }}</td>
          <td v-if="classNumber <= 2 && datasetType != 'continuous'" class="column5">{{ `${item.metrics.precision.average.toFixed(3)}` }}</td>
          <td v-if="classNumber <= 2 && datasetType != 'continuous'" class="column6">{{ `${item.metrics.recall.average.toFixed(3)}` }}</td>
          <td v-if="classNumber <= 2 && datasetType != 'continuous'" class="column7">{{ `${item.metrics.f1.average.toFixed(3)}` }}</td>
         
          <td v-if="classNumber <= 2 && datasetType == 'continuous' && display_mode != 'uncertain'" class="column5">{{ `${continuous_dict[item.classifier].precision.toFixed(3)}` }}</td>
          <td v-if="classNumber <= 2 && datasetType == 'continuous' && display_mode != 'uncertain'" class="column6">{{ `${continuous_dict[item.classifier].recall.toFixed(3)}` }}</td>
          <td v-if="classNumber <= 2 && datasetType == 'continuous' && display_mode != 'uncertain'" class="column7">{{ `${continuous_dict[item.classifier].f1.toFixed(3)}` }}</td>


          <td v-if="classNumber <= 2 && datasetType == 'continuous' && display_mode == 'uncertain'" class="column5">{{ `${continuous_dict[item.classifier].m_precision.toFixed(3)}` }}</td>
          <td v-if="classNumber <= 2 && datasetType == 'continuous' && display_mode == 'uncertain'" class="column6">{{ `${continuous_dict[item.classifier].m_recall.toFixed(3)}` }}</td>
          <td v-if="classNumber <= 2 && datasetType == 'continuous' && display_mode == 'uncertain'" class="column7">{{ `${continuous_dict[item.classifier].m_f1.toFixed(3)}` }}</td>

          <td v-if="datasetType == 'continuous' && display_mode != 'uncertain'" class="column8">{{ `${continuous_dict[item.classifier].auc_area.toFixed(3)}` }}</td> 
          <td v-if="datasetType == 'continuous' && display_mode == 'uncertain'" class="column8">{{ `${continuous_dict[item.classifier].ins_per}` }}</td> 
        </tr> 
      </tbody>
    </template>  
    </v-data-table>
  </div>
</template>

<script lang="ts">
import Vue from 'vue';
import * as d3 from 'd3';
import {
  BoxProps,
  Metrics,
  ContinuousMetrics,
} from '../../types';
import {
  instanceById,
  intersection,
} from '../../utils';
interface Header {
  text: string;
  value: string;
}
interface MetricsWithClassifier {
  classifier: string;
  metrics: Metrics;
}
interface ContinuousMetricsWithClassifier{
  classifier: string;
  continuous_metrics: ContinuousMetrics;
}


export default Vue.extend({
  name: 'MetricsTable',
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
    const display_mode = 'overall' as 'overall' | 'uncertain' 
    const weightedPerformance = 'normal' as 'normal' | 'weighted'

    return {
      weightedPerformance,
      display_mode:'overall',
      pagination: {
        rowsPerPage: 10,
      },
      panel: [],
      sortby: [],
      classNumber:[...this.boxProps.classes].length,
    };
  },
  computed: {
    addedThresholdClassifiers(): [] {
      if (this.$store.state.datasetType != "continuous") {
        return []
      }
      return this.$store.state.addedThresholdClassifiers.map((c)=>c.name);
    },
    additionalMetrics():{
        [classifier: string]: Metrics,
      } {
      return this.$store.getters.additionMetrics;
    },
    thresholdClassifierNameList():string[] {
      return this.$store.state.thresholdClassifierNameList
    },
    classifierBandWidthDict(): string[] {
      return this.boxProps.classifierBandWidthDict;
    },
    classifierThresholds():{} {
      let classifierThresholds = {}
      this.thresholdClassifierNameList.forEach((c)=>{
        let classifier = c.split("_")[0]
        let threshold = (parseInt(c.split("_")[1]) / 100).toFixed(2)
        classifierThresholds[classifier] = threshold
      })
      return classifierThresholds;
    },
    datasetType(): string{
      var datasetType = this.$store.state.datasetType;
      return datasetType;
    },
    continuousClassifierName():{} {
      var continuousClassifierName = {}
      this.classifiers.forEach((c)=>{
        if (this.$store.state.datasetType == "continuous") {
          continuousClassifierName[c] = c + "_" + this.classifierThresholdDict[c]/100
        } else {
          continuousClassifierName[c] = c;
        }
      })
      return continuousClassifierName;
    },
    weighted_metrics() : ContinuousMetricsWithClassifier[] {
      const storeContinuousMetrics: {
        [classifier: string]: ContinuousMetrics,
      } = this.$store.getters.weighted_metrics;
      const weighted_metrics: ContinuousMetricsWithClassifier[] = Object.entries(storeContinuousMetrics).map(([classifier, m]) => {
        return {
          classifier,
          continuous_metrics: m,
        };
      });
      return weighted_metrics;
    },
    continuous_metrics(): ContinuousMetricsWithClassifier[] {
      const storeContinuousMetrics: {
        [classifier: string]: ContinuousMetrics,
      } = this.$store.getters.continuous_metrics;
      const continuous_metrics: ContinuousMetricsWithClassifier[] = Object.entries(storeContinuousMetrics).map(([classifier, m]) => {
        return {
          classifier,
          continuous_metrics: m,
        };
      });
      return continuous_metrics;
    },
    continuous_dict(): {} {
      const continuous_dict = this.weightedPerformance == 'normal' ? this.$store.getters.continuous_metrics: this.$store.getters.weighted_metrics;
      const standardClassifier = ['Majority Classifier','Oracle', 'Random Classifier']
      const classifierBandWidthDict = this.classifierBandWidthDict
      if (this.datasetType == 'continuous'){
        let new_continuous_dict = {}
        for (let key in continuous_dict){
          if (!standardClassifier.includes(key)){
            new_continuous_dict[key] = continuous_dict[key]
            if (this.display_mode == 'uncertain') {
              let real_tp = new_continuous_dict[key].tp 
              let real_tn = new_continuous_dict[key].tn
              let real_fp = new_continuous_dict[key].fp
              let real_fn = new_continuous_dict[key].fn
              new_continuous_dict[key].m_accuracy  = (real_tp + real_tn) / (real_tp + real_fp + real_tn + real_fn)       
              new_continuous_dict[key].m_precision = (real_tp)  / (real_tp + real_fp)   
              new_continuous_dict[key].m_recall = (real_tp) / (real_tp + real_fn)
              new_continuous_dict[key].m_f1 = (new_continuous_dict[key].m_precision + new_continuous_dict[key].m_recall == 0) ? 0 : 2 * new_continuous_dict[key].m_precision * new_continuous_dict[key].m_recall / (new_continuous_dict[key].m_precision + new_continuous_dict[key].m_recall)
              if ((Math.sqrt((real_tp + real_fp) * (real_tp + real_fn) * (real_tn + real_fp) * (real_tn + real_fn))) == 0) {
                new_continuous_dict[key].m_mcc = 0;
              } 
              if ((real_tp+real_fp)*(real_tp+real_fn)*(real_tn+real_fp)*(real_tn+real_fn) != 0) {
                new_continuous_dict[key].m_mcc = ((real_tp*real_tn-real_fp*real_fn) / Math.sqrt((real_tp + real_fp) * (real_tp + real_fn) * (real_tn + real_fp) * (real_tn + real_fn)))
              } 
            } else {
              new_continuous_dict[key].m_accuracy = 0
              new_continuous_dict[key].m_precision = 0
              new_continuous_dict[key].m_recall = 0
              new_continuous_dict[key].m_f1 = 0
              new_continuous_dict[key].m_mcc = 0
            }
          } 
        }
        return new_continuous_dict
      }
      return continuous_dict;
    },
   
    metrics(): MetricsWithClassifier[] {
      const standardClassifier = ['Majority Classifier','Oracle', 'Random Classifier']
      const storeMetrics: {
        [classifier: string]: Metrics,
      } = this.$store.getters.metrics;
      const metrics: MetricsWithClassifier[] = Object.entries(storeMetrics).map(([classifier, m]) => {
        return {
          classifier,
          metrics: m,
        };
      })
  
      let new_metrics: MetricsWithClassifier[] = []
      if (this.datasetType == 'continuous') {
        const addtionalStoreMetrics: {
          [classifier: string]: Metrics,
        } = this.$store.getters.additionMetrics;
        const additionMetrics: MetricsWithClassifier[] = Object.entries(addtionalStoreMetrics).map(([classifier, m]) => {
          return {
            classifier,
            metrics: m,
          };
        })
        for (let item in metrics) {
          if (!standardClassifier.includes(metrics[item].classifier)) {
            new_metrics.push(metrics[item])
          }
        }
        for (let item in additionMetrics) {
          if (!standardClassifier.includes(additionMetrics[item].classifier)) {
            new_metrics.push(additionMetrics[item])
          }
        }
        return new_metrics
      }
      return metrics;
    },
    classes(): string[] {
      return [...this.boxProps.classes];
    },
    classifiers(): string[] {
      return [...this.boxProps.classifiers];
    },
    headers(): Header[] {
      const headers = this.datasetType != "continuous"?[
        { text: 'Classifier', value: 'classifier' },
        { text: (this.weightedPerformance == 'normal' ? '' : 'Weighted ') + 'Accuracy', value: 'accuracy' },
        { text: (this.weightedPerformance == 'normal' ? '' : 'Weighted ') + 'MCC', value: 'mcc' },
      ]:this.display_mode == 'overall'?[
        { text: 'Classifier', value: 'classifier' },
        { text: 'Threshold', value: 'threshold' },
        { text: (this.weightedPerformance == 'normal' ? '' : 'Weighted ') + 'Accuracy', value: 'accuracy' },
        { text: (this.weightedPerformance == 'normal' ? '' : 'Weighted ') + 'MCC', value: 'mcc' },
      ]
        : [
        { text: 'Classifier', value: 'classifier' },
        { text: 'Uncertain Range', value: 'uncertainty' },
        { text: (this.weightedPerformance == 'normal' ? '' : 'Weighted ') + 'Accuracy', value: 'accuracy' },
        { text: (this.weightedPerformance == 'normal' ? '' : 'Weighted ') + 'MCC', value: 'mcc' },
      ];
      if (this.classes.length<= 2) {
        headers.push({ text: (this.weightedPerformance == 'normal' ? '' : 'Weighted ') + 'Precision', value: 'precision' })
        headers.push({ text: (this.weightedPerformance == 'normal' ? '' : 'Weighted ') + 'Recall', value: 'recall' })
        headers.push({ text: (this.weightedPerformance == 'normal' ? '' : 'Weighted ') + 'F1', value: 'f1' })
      } else {
        headers.push({ text: (this.weightedPerformance == 'normal' ? '' : 'Weighted ') + 'Micro-F1', value: 'microf1' })
        headers.push({ text: (this.weightedPerformance == 'normal' ? '' : 'Weighted ') + 'Macro-F1', value: 'macrof1' })
      }
      if (this.datasetType == "continuous" ){
        if (this.display_mode == 'overall') {
          headers.push({ text: 'AUC', value: 'auc_area' })
        } else {
          headers.push({ text: 'Instances Percentage', value: 'ins_per' })
        }
      } 
     
      return headers;
    },
    instances(): string[] {
      return [...this.boxProps.instances];
    },
    truncatedInstances(): string[] {
      return this.instances.slice(0, 10);
    },
  },
  mounted() {
    console.log(this.metrics);
    console.log(this.classes)
  },
});
</script>

<style scoped>
.card {
  background-color: white;
}
.v-data-table tbody tr td {
    font-size: 14px !important;
    padding: 0px;
}

</style>