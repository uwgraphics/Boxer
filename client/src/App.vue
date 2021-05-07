<template>
      
  <v-app>
    <div class="app-container">
       
      <div class="app-bar">
        <v-dialog v-model="load_dialog" max-width="400">
          <template v-slot:activator="{ on }">
            <v-btn v-on="on" fab small>
              <v-icon>add</v-icon>
            </v-btn>
          </template>
          <DatasetSelectorPopup />
        </v-dialog>
        <span class="dataset-title">{{ $store.state.chosenDataset.name }}</span>
        
        <v-btn @click="change_grid_size" fab small class="ml-10">
          <v-icon>grid_on</v-icon>
        </v-btn>


        <v-menu class='select_view' close-on-click transition="slide-y-transition">
            <template v-slot:activator="{ on, attrs }"> 
                <v-btn   v-bind="attrs" v-on="on" class="ml-5">
                    Views
                </v-btn>
            </template>
            <v-list>
                <v-list-item v-for="view in viewsMapping" :key="view.view"
                @click="() => $store.dispatch('openView', view.view)">
                    <v-list-item-title>
                        <v-btn block color="white">{{ view.view_name }}</v-btn>
                    </v-list-item-title>
                </v-list-item>
            </v-list>
        </v-menu>
        <multiselect class='select_classifiers' placeholder="Excluded classifiers"
            v-model="value_classifier" :options="classifiers" multiple>
        </multiselect>

        <!-- <v-btn v-if="fixedDataset == 'yes'" class="ml-10" v-on:click="resume_views()">Resume Views </v-btn> -->

        <v-btn  class="ml-10" v-on:click="save_views()">Save Views </v-btn>

        <v-btn class="ml-10" v-on:click="reload_views()">Reload Views </v-btn>



      </div>
      
      <div class="main">
        <div class="NavigationDrawer is-closed" id="nav-1">
          <Navbar />
        </div>
        <RigidTileHome />
        <v-snackbar
          v-model="snackbar"
          style="text-align: center;"
          :timeout="0"
        >
            <span>
              SET UNION MODE
            </span>
        </v-snackbar>
      </div>

      <!-- <ejs-button cssClass='e-link' v-on:click.native='btnClick'>Help ? </ejs-button> -->
      <v-menu class='select_help' close-on-click transition="slide-y-transition">
          <template v-slot:activator="{ on, attrs }"> 
              <v-btn   v-bind="attrs" v-on="on" class="ml-5">
                  Help
              </v-btn>
          </template>
          <v-list>
              <v-list-item v-for="button in helpButtons" :key="button.name"
              @click="() => btnClick(button.name)">
                  <v-list-item-title>
                      <v-btn block color="white">{{ button.name }}</v-btn>
                  </v-list-item-title>
              </v-list-item>
          </v-list>
      </v-menu>

    </div>
  </v-app>
</template>


<script lang="ts">
import DatasetSelectorPopup from './components/left-drawer/DatasetSelectorPopup.vue';
import Navbar from '@/components/left-drawer/Navbar.vue';
import RigidTileHome from '@/views/RigidTileHome.vue';
import Vue from 'vue';
import { mapState } from 'vuex';
import VueSimpleAlert from "vue-simple-alert";
import { ButtonPlugin } from '@syncfusion/ej2-vue-buttons';
import { enableRipple } from '@syncfusion/ej2-base';
import Multiselect from 'vue-multiselect'
// import loading from 'vue-full-loading'

Vue.use(VueSimpleAlert);
enableRipple(true);
Vue.use(ButtonPlugin);

import {
  EntityType,
  SelectionAction,
  VisualizationType
} from './types';
export default Vue.extend({
  name: 'App',
  components: {
    DatasetSelectorPopup,
    Navbar,
    RigidTileHome,
    Multiselect,
  },
  data() {
    
    return {
      load_dialog: false,
      value_classifier: null,
    };
  },
  mounted() {
    this.$store.dispatch( 'loadFirstDataset' );
    window.addEventListener( 'keydown', e => this.$store.dispatch("changedToggleShift", e) );
    window.addEventListener( 'keyup', e => this.$store.dispatch("changedToggleShift", e) );
  },
  computed: {
    // fixedDataset():string {
    //   return this.$store.state.fixedDataset;
    // },
    helpButtons(): any[] {
      // if (this.fixedDataset == 'yes') {
      //   return [
      //     {'name':'Overall Help'},
      //     {'name':'View Description'},
      //     {'name':'Related Use case'}
      //   ]
      // } else {
        
      // }
      return [
          {'name':'Overall Help'},
          {'name':'View Description'},
        ]
    },
    viewsMapping(): any[] {
      if (this.datasetType == 'continuous') {
        return [
          {'view':VisualizationType.CA,  'view_name': 'Performance (Overall)'},
          {'view':VisualizationType.SCP, 'view_name': 'Performance (Selection)'},
          {'view':VisualizationType.CC,  'view_name': 'Performance (Curves)'},
          {'view':VisualizationType.RC,  'view_name': 'Reliability (Curves)'},
          {'view':VisualizationType.CB,  'view_name': '(Trinary) Performance Confidence'},
          {'view':VisualizationType.BA,  'view_name': '(Trinary) Bandwidth Assessment'},
          {'view':VisualizationType.REC, 'view_name': '(Trinary) Rejected Curve'},
          {'view':VisualizationType.TID, 'view_name': '(Trinary) Instance Distribuion'},
          {'view':VisualizationType.UM,  'view_name': 'Uncertainty HeatMap'},
          {'view':VisualizationType.SP,  'view_name': 'Scatter Plot'},
          {'view':VisualizationType.FH,  'view_name': 'Feature Histogram'},
          {'view':VisualizationType.CMG, 'view_name': 'Confusion Matrix Grid'},
          {'view':VisualizationType.PCC, 'view_name': 'Pairwise Classifier Consensus'},
          {'view':VisualizationType.OCA, 'view_name': 'Cumulative Accuracy'},
          {'view':VisualizationType.SM,  'view_name': 'Metrics Table'},
          {'view':VisualizationType.SMP, 'view_name': 'Metrics Parallel'},
          {'view':VisualizationType.ITL, 'view_name': 'Instance List'},
          {'view':VisualizationType.FI, 'view_name': 'Focus Item'},
        ]
      }
      return [
          {'view':VisualizationType.CA,  'view_name': 'Performance (Overall)'},
          {'view':VisualizationType.SCP, 'view_name': 'Performance (Selection)'},
          {'view':VisualizationType.COV, 'view_name': 'Performance (Per Class)'},
          {'view':VisualizationType.FH,  'view_name': 'Feature Histogram'},
          {'view':VisualizationType.CMG, 'view_name': 'Confusion Matrix Grid'},
          {'view':VisualizationType.PCC, 'view_name': 'Pairwise Classifier Consensus'},
          {'view':VisualizationType.OCA, 'view_name': 'Cumulative Accuracy'},
          {'view':VisualizationType.SM,  'view_name': 'Metrics Table'},
          {'view':VisualizationType.SMP, 'view_name': 'Metrics Parallel'},
          {'view':VisualizationType.ITL, 'view_name': 'Instance List'},
          {'view':VisualizationType.FI, 'view_name': 'Focus Item'},
        ] 
    },
    classifiers(): string[] {
      return [...this.$store.getters.classifiers];
    },
    classes(): string[] {
      return [...this.$store.getters.classes];
    },
    views(): string[] {
      return this.$store.state.views.all;
    },
    corsError() {
      return !this.$store.state.corsError;
    },
    ...mapState([
      'chosenDataset',
    ]),
    snackbar() {
      return !this.$store.getters.intersectionMode;
    },
    datasetType(): string {
      return this.$store.state.datasetType;
    }
  },
  watch: {
    value_classifier() {
      const payload: {
        entityType: EntityType,
        newFilter: {
          type: SelectionAction,
          set: Set<string>,
        },
      } = {
        entityType: EntityType.Classifier,
        newFilter: {
          type: SelectionAction.Exclude,
          set: new Set(this.value_classifier),
        },
      };
      this.$store.dispatch('changedFilter', payload);
      if (this.datasetType == 'continuous'){
        this.$store.dispatch('changedContinuousMetrics')
      }
    },
    chosenDataset() {
      this.load_dialog = false;
    },
    corsError() {
      this.$alert("Dataset load failed. Please make sure turn on the CORS extension");
    }
  },
  methods: {
    btnClick(name) {
      if (name == 'Related Use case') {
        let url = this.$store.state.chosenFixedDataset.related_use_case
        window.open(url);
      } else if (name == 'View Description') {
        window.open("https://graphics.cs.wisc.edu/Vis/Boxer/docs/user_guide/view_description/")
      } else {
        window.open("https://graphics.cs.wisc.edu/Vis/Boxer/");
      }
    },
    change_grid_size() {
      this.$store.dispatch("changedGridSize");
    },
    save_views() {
      this.$store.dispatch("saveViews")
      this.$store.dispatch("wrtieConfig")
    },
    reload_views() {
      this.$store.dispatch("reloadViews")
    },
    resume_views() {
      this.$store.dispatch("resumeViews");
    },
    buttonPush(b) {
      console.log("DOWN", b);
    },
    buttonUp(b) {
      console.log("UP", b);
    },
    toggleIsClosed() {
      const nav = document.getElementById('nav-1');
      if (nav === null) {
        return;
      }
      nav.classList.toggle('is-closed');
    },
  },
  
});
</script>
<style src="vue-multiselect/dist/vue-multiselect.min.css"></style>

<style scoped>
@import '../node_modules/@syncfusion/ej2-base/styles/material.css';
@import '../node_modules/@syncfusion/ej2-buttons/styles/material.css';

.main {
  flex: 1;
  display: flex;
}
.app-container {
  --drawer-width: 200px;
  display: flex;
  flex-direction: column;
  position: absolute;
  top: 0; right: 0; bottom: 0; left: 0;
  font-size: 10px;
}
.Content {
  flex: 1;
  background: lightgray;
  padding: 10px;
  display: flex;
}
.app-bar {
  flex: 0;
  background: #2196F3;
  font-size: 18px;
  color: white;
}
.dataset-title {
  margin-left: 10px;
}
.NavigationDrawer {
  flex: 0 0 auto;
  background: #FFFFFF;
  width: var(--drawer-width);
  transition: all 0.3s ease-in-out;
}
.is-closed {
  margin-left: calc(-1 * var(--drawer-width));
  opacity: 0;
}


.select_classifiers {
  float: right;
  width: 20%;
}

.select_classes {
  float: left;
  width: 30%;
  /* padding: 10px; */
}
.v-btn {
  text-transform:none !important;
}

</style>
