/**
 * VisualizationPanelVocabularyTab.js COPYRIGHT FUJITSU LIMITED 2021
 */
import React from 'react';
import PropTypes from 'prop-types';

import CytoscapeComponent from 'react-cytoscapejs';
import Cytoscape from 'cytoscape';
import edgehandles from 'cytoscape-edgehandles';

import dagre from 'cytoscape-dagre';
import klay from 'cytoscape-klay';

import {brown} from '@material-ui/core/colors';
import {red} from '@material-ui/core/colors';
import {orange} from '@material-ui/core/colors';
import {yellow} from '@material-ui/core/colors';
import {lightGreen} from '@material-ui/core/colors';
import {green} from '@material-ui/core/colors';
import {lightBlue} from '@material-ui/core/colors';
import {blue} from '@material-ui/core/colors';
import {deepPurple} from '@material-ui/core/colors';
import {purple} from '@material-ui/core/colors';

import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import Grid from '@material-ui/core/Grid';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';

import {observer} from 'mobx-react';

import DialogSettingSynonym from './DialogSettingSynonym';
import DialogOkCancel from './DialogOkCancel';
import DialogUpdateVocabularyError from './DialogUpdateVocabularyError';
import Search from './Search';

Cytoscape.use(edgehandles);
Cytoscape.use(dagre);
Cytoscape.use(klay);


/**
 * Visualization screen panels vocabulary tab components
 * @extends React
 */
export default
@observer class VisualizationPanelVocabularyTab extends React.Component {
  /**
   * Constructor
   */
  constructor() {
    super();
    this.zoomTimeoutId = -1;
    this.updateElesTimeoutId = -1;
    this.isReset = true;
    this.fitCenterPan = true;
    this.situationArr = [];
    this.message = '';
    this.synonymSource = null;
    this.synonymTarget = null;

    this.state = { 
      transformTogle: false,
      dlgSynonymOpen: false,  // dialog for Synonym term
      dlgBroaderOpen: false,  // dialog for Broader term
      dlgUpVocOpen: false,    // dialog for save position
      dlgDeselectTermOpen: false, // dialog for deselect term confirm
      dlgErrOpen: false,      // dialog for Error
      reason: '',             // Reason for Error 
    };

    this.ehTop = null;      // edgehandles top   object
    this.ehLeft = null;     // edgehandles left  object
    this.ehRight = null;    // edgehandles tight object
    this.hitHandle = -1;    // handle Position [-1='not hit' / 1='top' / other='left or right' ]
  }

  /**
   * Post-mount processing
   * Graph information initialization
   */
  componentDidMount() {
    this.setUpListeners();
    this.updateElesClass();
    this.initEdgeHandles();
    this.setCyMinMaxZoom();
  }

  /**
   * Update post-processing
   * Graph redraw process after update
   */
  componentDidUpdate(prevProps, prevState) {
    
    this.setPanZoom();
    if (prevProps.editingVocabulary.editingVocabulary !== this.props.editingVocabulary.editingVocabulary) {
      this.updateElesClass();
    }else{     
      this.onPanZoom();
    }
  }
  /**
   * Max min scale
   */
   setCyMinMaxZoom() {
    const cy = this.cy;
    cy.minZoom(0.0025);
    cy.maxZoom(1.2);
    const cyw = cy.width();
    const cyh = cy.height();
    cy.viewport({zoom: 0.005, pan: {x: cyw/2, y: cyh/2}});
  }
  /**
   * Update graph data
   */
  updateElesClass() {
    if (this.updateElesTimeoutId > 0) {
      clearTimeout(this.updateElesTimeoutId);
      this.updateElesTimeoutId = -1;
    }

    // Suppress redundant update processing by consecutive occurrence of events.
    this.updateElesTimeoutId = setTimeout( () => {

      const cy = this.cy;

      // node Initialization
      this.initStyleForAllNodes();
      const layout = cy.layout({name: 'preset'});
      layout.run();

      // Update layout
      const currentZoom = cy.zoom();
      const currentPan = cy.pan();

      if (this.isReset) {
        this.isReset = false;
        // At the first display, not the entire display, narrow down to a certain magnification.
        cy.zoom(0.005);
      } else {
        this.fitByPanZoom(currentPan, currentZoom);
      }

      this.onPanZoom();

    }, 300);
  }

  /**
   * Pan, zoom reset notification by updating editing lexical data
   */
  doReset() {
    this.isReset = true;
  }

  /**
   * Set the background color style for nodeObject
   * @param {Object} eles    node object[IN/OUT]
   * @param {Boolean} confirm - confirmed information[IN]
   */
  setConfirmStyle(eles, confirm) {
    if (confirm) {
      if (confirm == 1) {
        const confirmColor = this.props.editingVocabulary.confirmColor;
        let bgStyle;
        switch (confirmColor) {
          case 'brown': bgStyle = 'bgBrown'; break;
          case 'red': bgStyle = 'bgRed'; break;
          case 'orange': bgStyle = 'bgOrange'; break;
          case 'yellow': bgStyle = 'bgYellow'; break;
          case 'lightGreen': bgStyle = 'bgLightGreen'; break;
          case 'green': bgStyle = 'bgGreen'; break;
          case 'lightBlue': bgStyle = 'bgLightBlue'; break;
          case 'blue': bgStyle = 'bgBlue'; break;
          case 'deepPurple': bgStyle = 'bgDeepPurple'; break;
          case 'purple': bgStyle = 'bgPurple'; break;
          default: bgStyle = 'bgBlack'; break;
        }

        if (bgStyle) {
          eles.addClass(bgStyle);
        }
      }
    } else {
      eles.addClass('bgBlack');
    }
  }

  /**
   * pan & zoom setting
   * 
   */
  setPanZoom() {
    const cy = this.cy;
    
    const initPan = {x: cy.width()/2, y: cy.height()/2};
    if( undefined == this.situationArr[ this.props.editingVocabulary.selectedFile.id]){
      cy.fit(cy.nodes,50 );
    }else{
      cy.pan( this.situationArr[ this.props.editingVocabulary.selectedFile.id].pan || initPan);
      cy.zoom( this.situationArr[ this.props.editingVocabulary.selectedFile.id].zoom || 0.005);
    }
  }
  /**
   * [onPanZoom description]
   */
  onPanZoom() {
    if (this.zoomTimeoutId > 0) {
      clearTimeout(this.zoomTimeoutId);
      this.zoomTimeoutId = -1;
    }

    this.zoomTimeoutId = setTimeout( () => {
      const cy = this.cy;

      // List of nodes in view
      const ext = cy.extent();

      let nodesInView = cy.nodes().filter((n) => {
        const bb = n.boundingBox();
        // Show nodes if any are in the viewport range
        return bb.x1 > (ext.x1 - bb.w) &&
               bb.x2 < (ext.x2 + bb.w) &&
               bb.y1 > (ext.y1 - bb.h) &&
               bb.y2 < (ext.y2 + bb.h);
      });
      if (nodesInView.length == 0) {
        nodesInView = cy.nodes();
      }

      // get element near center
      const zoom = cy.zoom();
      const cpX = ( ext.x1 + ext.w / 2 ) / zoom;
      const cpY = ( ext.y1 + ext.h / 2 ) / zoom;
      let sortArr=[];
      nodesInView.map((n, index)=>{

        // excluding edgehandle 
        if( n.hasClass('eh-handle')){ 
          return;
        }
        const bb = n.boundingBox();
        sortArr = [...sortArr, {
          'index': index,
          'distance': Math.abs( bb.x1 / zoom - cpX ) + Math.abs( bb.y1 / zoom - cpY )
        }]
      })

      sortArr.sort((a, b)=> { return a.distance - b.distance; });
      if( sortArr.length > 100 ) sortArr.splice( 100);

      // 100 visibleNodesInView
      let nodesInViewLimit100 = [];
      sortArr.forEach((data)=>{
        nodesInViewLimit100 =
          [...nodesInViewLimit100, nodesInView[data.index]];
      })

      this.initStyleByPanZoom();

      // term point size adjustment
      nodesInView.style({
        "width": Math.max(5.0/zoom, 5.0),
        "height": Math.max(5.0/zoom, 5.0),
      });

      // edges line width adjustment
      const edges = cy.edges();
      edges.style({
        "width": Math.max(3.0/zoom, 3.0),
      });
      
      const nodeInViewStyle = {        
        'width': 'label',
        'height': 'label',
        'font-size': Math.min(4800, Math.max(16/zoom, 16)),
        'border-width': Math.max(2.0/zoom, 2.0),
        'padding': Math.max(10.0/zoom, 10.0),
      };
      nodesInViewLimit100.forEach((node, index)=>{
        const eles = cy.$id(node.data().id);
        
        // Adjust term size ↓ but Causes of color settings not working 
        node.style(nodeInViewStyle);

        node.addClass('showText');
        // Setting color information
        if (node.data().vocabularyColor) {
          eles.addClass(node.data().vocabularyColor);
        }

        // Setting of confirmation information
        this.setConfirmStyle(eles, node.data().confirm);
      });
      const selectTermList = this.props.editingVocabulary.selectedTermList;
      selectTermList.forEach((item, index)=>{
        this.changeSelectedTermColor(item.id);
      });
      const currentNode = this.props.editingVocabulary.currentNode;
      if (currentNode.id) {
        const selectedele = cy.$id(currentNode.id);
        selectedele.addClass('selected');
        selectedele.addClass('showText');
        // Setting of color information
        if (selectedele.data().vocabularyColor) {
          selectedele.addClass(selectedele.data().vocabularyColor);
        }

        // Setting of confirmation information
        this.setConfirmStyle(selectedele, selectedele.data().confirm);

        // Newly added terms may not appear in the view because their coordinate values remain at their initial values.
        // In that case, it can be forced into the view by showText.
        if (currentNode.broader_term) {
          const brdrTrmNode = cy.nodes().filter((n) => {
            return n.data().term == currentNode.broader_term;
          });
          if (brdrTrmNode.length > 0) {
            if (!brdrTrmNode.hasClass('showText')) {
              brdrTrmNode.addClass('showText');
              const eles = cy.$id(brdrTrmNode.data().id);
              // Setting of color information
              if (brdrTrmNode.data().vocabularyColor) {
                eles.addClass(brdrTrmNode.data().vocabularyColor);
              }

              // Setting of confirmation information
              this.setConfirmStyle(eles, brdrTrmNode.data().confirm);
            }
          }
        }
        if (currentNode.preferred_label) {
          const synonymNode = cy.nodes().filter((n) => {
            return n.data().preferred_label == currentNode.preferred_label &&
                   n.data().term != currentNode.term;
          });
          if (synonymNode.length > 0) {
            synonymNode.forEach((node) => {
              if (!node.hasClass('showText')) {
                node.addClass('showText');

                const eles = cy.$id(node.data().id);
                // Setting of color information
                if (node.data().vocabularyColor) {
                  eles.addClass(node.data().vocabularyColor);
                }

                // Setting of confirmation information
                this.setConfirmStyle(eles, node.data().confirm);
              }
            });
          }
        }
      }

      // Hide inactive handles 
      this.hideHandlePostion();
    }, 10);
  }

  changeSelectedTermColor(id, isAddTerm=true){

    const cy = this.cy;    
    const zoom = cy.zoom();
    const bdrWidth = Math.max((isAddTerm?4.0:2.0)/zoom, (isAddTerm?4.0:2.0));
    const nodeSelectedStyle = {        
      'width': 'label',
      'height': 'label',
      'font-size': Math.min(4800, Math.max(16/zoom, 16)),
      'border-width': bdrWidth,
      'padding': Math.max(10.0/zoom, 10.0),
      'shape': 'rectangle',      
    };
    const eles = cy.$id(id);
    eles.style(nodeSelectedStyle);
    eles.addClass('showText');
    // Setting color information
    if (eles.data().vocabularyColor) {
      eles.addClass(eles.data().vocabularyColor);
    }
    // Setting of confirmation information
    this.setConfirmStyle(eles, eles.data().confirm);
  }

  /**
   * Restore to pan, zoom before layoutRun
   * @param  {Object} pan  get cy.pan()
   * @param  {Object} zoom get cy.zoom()
   */
  fitByPanZoom(pan, zoom) {

    if( !this.fitCenterPan){
      return;
    }

    const cy = this.cy;
    cy.zoom(zoom);
    if (this.props.editingVocabulary.currentNode.id) {
      const selectedele = cy.$id(this.props.editingVocabulary.currentNode.id);

      // Center selected eles
      cy.animate({
        center: {
          eles: selectedele,
        },
      }, {
        duration: 100,
      });
    } else {
      cy.pan(pan);
    }
  }

  /**
   * init EdgeHandles
   */
   initEdgeHandles(){
    const cy = this.cy;

    // the default values of each option are outlined below:
    let defaults ={
      preview: false, // whether to show added edges preview before releasing selection
      handleNodes: 'node.showText', // selector/filter function for whether edges can be made from a given node
      snap: false, // when enabled, the edge can be drawn by just moving close to a target node
      noEdgeEventsInDraw: false, // set events:no to edges during draws, prevents mouseouts on compounds
      handlePosition:  'middle top',// sets the position of the handle in the format of 'X-AXIS Y-AXIS' such as 'left top', 'middle top'
      edgeType: function (sourceNode, targetNode) {
        return 'flat';
      },
    };

    defaults.handlePosition = 'middle top';
    this.ehTop = cy.edgehandles( defaults);

    defaults.handlePosition = 'left middle';
    this.ehLeft = cy.edgehandles( defaults);
    
    defaults.handlePosition = 'right middle ';
    this.ehRight = cy.edgehandles( defaults);
  }

  /**
   * Deselect all nodes in cytoscape
   *
   * Called from EdithingVocablary.js 
   */
  cyDeselect(){
    this.cy.nodes().unselect();
  }

  /**
   * Event registration
   */
  setUpListeners() {
    this.cy.on('click', 'node', (event) => {
      
      // excluding edgehandle 
      if( event.target.hasClass('eh-handle')){ 
        return;
      }

      const target = event.target.data();
      let isAddTerm=false;
      const withKey = event.originalEvent.ctrlKey|| event.originalEvent.shiftKey;
      if( !withKey){
        if( this.props.editingVocabulary.selectedTermList.length > 1){
          this.props.editingVocabulary.deselectTermList();
          isAddTerm = this.props.editingVocabulary.setSelectedTermList(target.term);
          this.props.editingVocabulary.setCurrentNodeByTerm(target.term, target.id, null, true);
        }else{
          this.props.editingVocabulary.deselectTermList();
          if(this.props.editingVocabulary.currentNode.id !=  target.id){
            isAddTerm = this.props.editingVocabulary.setSelectedTermList(target.term);
          }
          this.props.editingVocabulary.setCurrentNodeByTerm(target.term, target.id);
        }
      }else{
        isAddTerm = this.props.editingVocabulary.setSelectedTermList(target.term);
        if(isAddTerm && this.props.editingVocabulary.selectedTermList.length == 1){
          this.props.editingVocabulary.setCurrentNodeByTerm(target.term, target.id);
        }else if(!isAddTerm && this.props.editingVocabulary.selectedTermList.length > 0){
          const firstSelectedTerm = this.props.editingVocabulary.selectedTermList.slice(0,1)[0];
          this.props.editingVocabulary.setCurrentNodeByTerm(firstSelectedTerm.term, firstSelectedTerm.id, null, true);
        }else if(!isAddTerm && this.props.editingVocabulary.selectedTermList.length == 0){
          this.props.editingVocabulary.setCurrentNodeByTerm(target.term, target.id);
        }
      }
      this.changeSelectedTermColor(target.id, isAddTerm);
    });

    this.cy.on('ehcomplete', (event, sourceNode, targetNode, addedEdge) => {
      
      addedEdge.remove();

      this.synonymSource = sourceNode.data();
      this.synonymTarget = targetNode.data();

      if( this.hitHandle == 1){
        this.message = '「'+sourceNode.data().term +'」　の上位語に 「'+targetNode.data().term +'」 を設定します\nよろしいですか？';
        this.setState({dlgBroaderOpen: true});
      } else{        
        this.setState({dlgSynonymOpen: true});   
      }
    });

    this.cy.on('ehstop', (event, sourceNode) => {
      this.hideHandlePostion();
    });

    this.cy.on('ehstart', (event, sourceNode) => {

      if( this.ehTop.handleNode!== undefined && !this.ehTop.handleNode.active()){
        this.ehTop.disable();
        this.ehTop.handleNode.style('opacity','0');
      }
      if( this.ehLeft.handleNode!== undefined && !this.ehLeft.handleNode.active()){
        this.ehLeft.disable();
        this.ehLeft.handleNode.style('opacity','0');
      }
      if( this.ehRight.handleNode!== undefined && !this.ehRight.handleNode.active()){
        this.ehRight.disable();
        this.ehRight.handleNode.style('opacity','0');
      }

      let cnt=0;
      const intervalId = setInterval(()=>{
        
        if(++cnt > 5) clearInterval(intervalId);
        const cy = this.cy;
        let ghostedges = cy.elements('.eh-ghost-edge');
        const val = Math.max(5.0/cy.zoom(), 5.0);
        if( ghostedges.length > 0){
          
          if( this.ehTop.handleNode!== undefined && this.ehTop.handleNode.active()){
            this.hitHandle = 1;
            ghostedges.style({
              'width': val,
              'line-color': 'yellow',
              'line-style': 'solid',
              'target-arrow-shape': 'vee',
              'target-arrow-color': 'yellow',
              'curve-style': 'straight',
            });
          }else{
            this.hitHandle = 0;
            ghostedges.style({
              'width': val,
              'line-color': 'blue',
              'line-style': 'dotted',
              'target-arrow-shape': 'none',
              'target-arrow-color': '',
              'curve-style': 'straight',
            });
          }
          clearInterval(intervalId);
        }
      },50);
    });

    this.cy.on('ehshow', (event, sourceNode) => {
      const cy = this.cy;
      
      let handles = cy.elements('.eh-handle');
      const val = Math.max(10.0/cy.zoom(), 10.0);
        
      if( handles.length > 0){
        handles.style({
          'background-color': 'royalblue',
          'width': val,
          'height': val,
          'opacity': 1,
        });
      }
      
      if( this.ehTop.handleNode !== undefined && this.ehTop.handleNode.length > 0){
        this.ehTop.handleNode.style({
          'background-color': 'lightsteelblue',
          'shape': 'triangle',
          'width': val * 1.5,
          'height': val * 1.5,
        });
      }
        
    });
    this.cy.on('pan', (event) => {
      if(undefined == this.situationArr[this.props.editingVocabulary.selectedFile.id]){
        this.situationArr[this.props.editingVocabulary.selectedFile.id] = {
          pan:undefined, 
          zoom:undefined
        }
      }
      const pan = this.cy.pan();
      const p ={
        x: pan.x, 
        y: pan.y
      };
      this.situationArr[this.props.editingVocabulary.selectedFile.id].pan= p;
      this.onPanZoom();
    });

    this.cy.on('zoom', (event) => {
      if(undefined == this.situationArr[this.props.editingVocabulary.selectedFile.id]){
        this.situationArr[this.props.editingVocabulary.selectedFile.id] = {
          pan:undefined, 
          zoom:undefined
        }
      }
      const z = Number( this.cy.zoom());
      this.situationArr[this.props.editingVocabulary.selectedFile.id].zoom = z;
      this.onPanZoom();
    });
  }

  /**
   * Hide inactive handles 
   * 
   * ・ It is necessary to hide the debris of the handle point when zooming and panning.
   * ・ The timing that can be displayed could only be found in "ehshow event" 
   * ・ If "display: element" is set in "ehshow event", an infinite loop will occur.
   *    -Switching between display and non-display with "opacity: 0/1" 
   */ 
  hideHandlePostion(){

      if( this.ehTop.handleNode !== undefined) this.ehTop.handleNode.style('opacity','0');
      if( this.ehLeft.handleNode !== undefined) this.ehLeft.handleNode.style('opacity','0');
      if( this.ehRight.handleNode !== undefined) this.ehRight.handleNode.style('opacity','0');

      this.ehTop.enable();
      this.ehLeft.enable();
      this.ehRight.enable();
  }

  /**
   * Set BroaderTerm 
   * 
   */
  setBroaderTerm(){

    const source = this.synonymSource;
    
    const nextBroaderTerm = this.synonymTarget.term;

    this.props.editingVocabulary.deselectTermList();
    if(this.props.editingVocabulary.currentNode.id !=  source.id){
      this.props.editingVocabulary.setSelectedTermList(source.term);
    }
    this.props.editingVocabulary.setCurrentNodeByTerm(source.term, source.id, null, true);

    this.props.editingVocabulary.updataBroaderTerm( [ nextBroaderTerm ] );

    const ret = this.props.editingVocabulary.updateVocabulary();
    if (ret !== '') {
      this.setState({dlgErrOpen: true, reason : ret});  
    }
  }

  /**
  * Initialization of array storing zoom and pan for each file 
  *
  * Called from EdithingVocablary.js 
  */
  situationArrReset( num=-1){
    if( num === -1){
      this.situationArr = [];
    }else{
      this.situationArr[ num] = undefined;
    }
  }

  /**
   * Layout update process for vocabulary selection
   *
   * If a vocabulary is selected, center the selected vocabulary (pan) and update the Node syle
   * Update Node syle when vocabulary is broken
   */
  fitToCurrent() {
    const cy = this.cy;
    const currentZoom = cy.zoom();
    const currentPan = cy.pan();
    this.fitByPanZoom(currentPan, currentZoom);
    if (!this.props.editingVocabulary.currentNode.id) {
      this.onPanZoom();
    }
  }

  /**
   * Fit the panel to display all cytoscape nodes
   * Called from EdithingVocablary.js 
   */
  fitToVisualArea() {
    const cy = this.cy;
    cy.fit(cy.nodes,50 );
  }

  /**
   * File selection event
   * @param  {object} event - information of event
   */
  handleChange(event) {
    this.props.editingVocabulary.selectFile(event.target.value);
    if (event.target.value == 0) {
      this.props.editingVocabulary.setSelected(0, true);
      this.props.editingVocabulary.setSelected(1, false);
    } else {
      this.props.editingVocabulary.setSelected(0, true);
      this.props.editingVocabulary.setSelected(1, true);
    }

    this.cy.one('render', (event) => {
      setTimeout( () => {
        this.onPanZoom();
      }, 100);
    });
  };

  /**
   * Sytle initialization for node
   */
  initStyleForAllNodes() {
    const cy = this.cy;

    // Node initialization
    cy.batch(function() {
      cy.nodes().removeClass(
          [
            'selected',
            'black',
            'brown',
            'red',
            'orange',
            'yellow',
            'lightGreen',
            'green',
            'lightBlue',
            'blue',
            'deepPurple',
            'purple',
            'bgBlack',
            'bgBrown',
            'bgRed',
            'bgOrange',
            'bgYellow',
            'bgLightGreen',
            'bgGreen',
            'bgLightBlue',
            'bgBlue',
            'bgDeepPurple',
            'bgPurple',
            'displayNone',
            'showText',
            'hiddenText',
            'defaultNodeClass',
          ],
      ).addClass('showText')
          .unselect();
    });
  }

  /**
   * Sytle initialization for node
   */
  initStyleByPanZoom() {
    const cy = this.cy;

    cy.batch(function() {
      cy.nodes().removeClass(
          [
            'defaultNodeClass',
            'selected',
            'showText',
            'hiddenText',
            'black',
            'brown',
            'red',
            'orange',
            'yellow',
            'lightGreen',
            'green',
            'lightBlue',
            'blue',
            'deepPurple',
            'purple',
            'bgBlack',
            'bgBrown',
            'bgRed',
            'bgOrange',
            'bgYellow',
            'bgLightGreen',
            'bgGreen',
            'bgLightBlue',
            'bgBlue',
            'bgDeepPurple',
            'bgPurple',
          ],
      ).removeStyle();
    });
  }


  /**
   * coordinate transform
   */
  coordinateTransform(){
    const cy = this.cy;
  
    const nodes = cy.nodes();
    const edges = cy.edges();

    nodes.lock();

    edges.forEach((edge) => {

      const snd = cy.$id(edge.data().source);
      const tnd = cy.$id(edge.data().target);

      snd.unlock();
      tnd.unlock();      
    });

    // get roots
    const sources = edges.sources();
    const targets = edges.targets();

    const roots = sources.filter((source,i)=>{
      const hits = targets.filter((target) =>{
        return source.data().term == target.data().term;
      });
      return hits.length?false:true;
    });

    // save roots data [ id & all connected elements & position ]
    let saveRoots = [];
    roots.forEach((node,i) => {
      const id =node.data().id;
      const suc =node.successors();
      const posi = node.position();
      
      saveRoots = [...saveRoots, {id:id,successors :suc ,pos:{x:posi.x, y:posi.y}} ];
    });
    
    // [ dagre ] layout options
    const defaults={      
      name: "dagre",
      fit:false,
      nodeDimensionsIncludeLabels:true,
      rankDir: "TB",
      ranker: "longest-path", 

      stop: function (e) {

        const cy = e.cy;
        saveRoots.forEach((nd,i) => {
          
          const fromPosi = nd.pos;

          const toNode = cy.$id(nd.id)
          const toPosi = toNode.position();
          
          const diffX = fromPosi.x-toPosi.x;
          const diffY = fromPosi.y-toPosi.y;

          toNode.position({x:toPosi.x + diffX, y:toPosi.y - diffY});

          nd.successors.forEach((suc,j) => {
            
            if(suc.group() =="nodes"){
              const posi = suc.position();
              suc.position({x:posi.x + diffX, y:posi.y - diffY});
            }
          });
        });
      }
    }

    // Extend the minimum length of edge 
    const zoom = cy.zoom();
    if( zoom > 0.007){
      const thisLen = parseInt(1 / zoom);
      defaults.minLen = thisLen;
    }
    
    cy.elements().layout( defaults).run();
    
    nodes.unlock();
  }
  
  /**
   * Update coordinate transform
   */
  async updateVocabularys() {
    
    const saveCurrentNodeTerm = await this.props.editingVocabulary.currentNode.term;
    
    this.fitCenterPan = false;
    const ret = await this.props.editingVocabulary.updateVocabularys( this.cy.nodes());
    this.fitCenterPan = true;

    if( saveCurrentNodeTerm && saveCurrentNodeTerm !== this.props.editingVocabulary.currentNode.term){
      await this.props.editingVocabulary.setCurrentNodeByTerm( saveCurrentNodeTerm);
    }
  }
  
  /**
   * deselection term
   */
   async deselectionConfirm(){

      const selectedTermList = this.props.editingVocabulary.selectedTermList;

      for (let num in selectedTermList) {
        const item = selectedTermList[num];
        await this.changeSelectedTermColor(item.id, false);
      }
      // currentNode clear
      await this.props.editingVocabulary.deselectTermList();       
      await this.props.editingVocabulary.setCurrentNodeByTerm('');
  }
  /**
   * When setting a synonym, select a Preferred term and then close the dialog 
   */
  handleClose( ret){
    this.setState({dlgSynonymOpen: false});
    
    if(ret ==='cancel'){
      // dialog return cancel click
      this.props.editingVocabulary.currentNodeClear();
      this.props.editingVocabulary.tmpDataClear();
      this.props.editingVocabulary.deselectTermList();

    }else if(ret !== ''){
      // updateVocabulary() return error reason
      this.setState({dlgErrOpen: true, reason : ret});  
    }
  }

  /**
   * Close the confirmation dialog and set the Broader term
   */
  handleBroaderClose(){
    this.message = '';
    this.setState({dlgBroaderOpen: false});   
    
    this.setBroaderTerm(); 
  }

  /**
   * Close the confirmation dialog and do not set the Broader term
   */
  handleBroaderCancelClose(){
    this.message = '';
    this.setState({dlgBroaderOpen: false});
  }

  /**
   * close error dialog 
   */
  handleErrClose(){
    this.setState({dlgErrOpen: false, reason: ''});   
  }

  /**
   * dialog handles for save position button 
   */
  handleUpVocOpen(){    
    this.message = '座標値を保存します\nよろしいですか？';
    this.setState({dlgUpVocOpen: true});
  }
  handleUpVocClose(){
    this.message = '';
    this.setState({dlgUpVocOpen: false});

    this.updateVocabularys();
  }
  handleUpVocCancelClose(){
    this.message = '';
    this.setState({dlgUpVocOpen: false});    
  }

  handleDeselectTermOpen(){
    this.message = "用語の選択を解除します。\nよろしいですか？";
    this.setState({dlgDeselectTermOpen: true});  
  }
  handleDeselectTermClose(){
    this.message = '';
    this.setState({dlgDeselectTermOpen: false});
    
    this.deselectionConfirm();
  }
  handleDeselectTermCancelClose(){
    this.message = '';
    this.setState({dlgDeselectTermOpen: false});
  }

  /**
   * render
   * @return {element}
   */
  render() {
    const nodeList = this.props.editingVocabulary.termListForVocabulary;
    const edgesList = this.props.editingVocabulary.edgesList;
    const disabledConfirm = this.props.editingVocabulary.selectedTermList.length;
    const transformTogle = this.state.transformTogle;

    return (
      <div>
        <Grid
          container
          spacing={2}
          className={this.props.classes.visualizationVocabularyHead}
        >
          <Grid item xs={5}>
            <Box>
              <Search
                classes={this.props.classes}
                editingVocabulary={this.props.editingVocabulary}
              />
            </Box>
          </Grid>
          <Grid item xs={5}>
            <Box>
              <Button
                style={{marginTop:'15px', marginRight:'8px'}}
                ml={3}
                variant="contained"
                color="primary"
                size={'small'}
                disabled={!disabledConfirm}
                onClick={()=>this.handleDeselectTermOpen()}
              >
                選択全解除
              </Button>
              <Button
                style={{marginTop:'15px', marginRight:'8px'}}
                ml={3}
                variant="contained"
                color="primary"
                size={'small'}
                disabled={transformTogle}
                onClick={()=>this.coordinateTransform()}
              >
              {transformTogle ? "座標変換済み" : "座標変換"}
              </Button>
              <Button
                style={{marginTop:'15px', marginRight:'8px'}}
                ml={3}
                variant="contained"
                color="primary"
                size={'small'}
                onClick={()=>this.handleUpVocOpen()}
              >
                座標値を保存
              </Button>
            </Box>
          </Grid>
          <Grid item xs={2}>
            <Box>
              <FormControl className={this.props.classes.fileSelecter}>
                <Select
                  labelId="file-select-label"
                  id="file-select"
                  value={this.props.editingVocabulary.selectedFile.id}
                  onChange={(e) => this.handleChange(e)}
                >
                  <MenuItem value={0}>編集用語彙</MenuItem>
                  <MenuItem value={1}>参照用語彙1</MenuItem>
                  <MenuItem value={2}>参照用語彙2</MenuItem>
                  <MenuItem value={3}>参照用語彙3</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Grid>
        </Grid>
        <DialogSettingSynonym
          onClose={this.handleClose.bind(this)}  
          open={this.state.dlgSynonymOpen}
          editingVocabulary={this.props.editingVocabulary}
          classes={this.props.classes}
          source={this.synonymSource}
          target={this.synonymTarget}
        />
        <DialogOkCancel
          onOkClose={() => this.handleBroaderClose()}
          onCancel={() =>this.handleBroaderCancelClose()}  
          open={this.state.dlgBroaderOpen}
          classes={this.props.classes}
          message={this.message}
        />
        <DialogOkCancel
          onOkClose={() => this.handleUpVocClose()}
          onCancel={() =>this.handleUpVocCancelClose()}  
          open={this.state.dlgUpVocOpen}
          classes={this.props.classes}
          message={this.message}
        />
        <DialogOkCancel
          onOkClose={() => this.handleDeselectTermClose()}
          onCancel={() =>this.handleDeselectTermCancelClose()}  
          open={this.state.dlgDeselectTermOpen}
          classes={this.props.classes}
          message={this.message}
        />

        <DialogUpdateVocabularyError
          onClose={() => this.handleErrClose()}
          open={this.state.dlgErrOpen}
          classes={this.props.classes}
          editingVocabulary={this.props.editingVocabulary}
          isFromEditPanel={false}
          reason={this.state.reason}
        />

        <CytoscapeComponent
          id="relation_term_graph_container"

          layout={{name: 'preset'}}
          cy={(cy) => {
            this.cy = cy;
          }}
          wheelSensitivity={0.5}
          elements={CytoscapeComponent.normalizeElements(
              {
                nodes: nodeList,
                edges: edgesList,
              })}

          style={{
            width: '100%',
            height: '680px',
            backgroundColor: '#E3E3E3',
          }}
          stylesheet={[
            {
              selector: 'node',
              style: {
              },
            },
            {
              selector: '.showText[term]',
              style: {
                'width': 'label',
                'height': 'label',
                'color': 'black',
                'text-background-shape': 'rectangle',
                'text-max-width': '200000px',
                'text-valign': 'center',
                'text-halign': 'center',
                'text-wrap': 'wrap',
                'content': 'data(term)',
                'shape': 'rectangle',
                'background-opacity': 0.6,
              },
            },
            {
              selector: '.selected',
              style: {
                'z-index': 100,
                'border-width': 3,
              },
            },
            {
              selector: 'edge',
              style: {
                'width': 3,
                'curve-style': 'straight',
              },
            },
            {
              selector: 'edge[arrow]',
              style: {
                'source-arrow-shape': 'data(arrow)',
              },
            },
            {
              selector: '.broader_term',
              style: {
                'source-arrow-color': 'black',
                'line-color': 'black',
              },
            },
            {
              selector: '.synonym',
              style: {
                'line-color': 'grey',
                'line-style': 'dotted',
              },
            },
            {
              selector: '.eh-handle',
              style: {
                width: 20,
                height: 20,
                shape: 'rectangle',
                'background-color': 'royalblue',
              }
            },
            
            {
              selector: '.eh-ghost-edge',
              style: {
                width: 10,
                'line-color': 'yellow',
                'line-style': 'solid',
                'target-arrow-shape': 'vee',
                'target-arrow-color': 'yellow',
                'curve-style': 'straight',
              }
            },
            {
              selector: '.displayNone',
              style: {
                'display': 'none',
              },
            },
            {
              selector: '.black',
              style: {
                'border-color': 'black',
              },
            },
            {
              selector: '.brown',
              style: {
                'border-color': '#795548',
              },
            },
            {
              selector: '.red',
              style: {
                'border-color': '#f44336',
              },
            },
            {
              selector: '.orange',
              style: {
                'border-color': '#ff9800',
              },
            },
            {
              selector: '.yellow',
              style: {
                'border-color': '#ffeb3b',
              },
            },
            {
              selector: '.lightGreen',
              style: {
                'border-color': '#8bc34a',
              },
            },
            {
              selector: '.green',
              style: {
                'border-color': '#4caf50',
              },
            },
            {
              selector: '.lightBlue',
              style: {
                'border-color': '#03a9f4',
              },
            },
            {
              selector: '.blue',
              style: {
                'border-color': '#2196f3',
              },
            },
            {
              selector: '.deepPurple',
              style: {
                'border-color': '#673ab7',
              },
            },
            {
              selector: '.purple',
              style: {
                'border-color': '#9c27b0',
              },
            },
            {
              selector: '.bgBlack',
              style: {
                'background-color': 'white',
              },
            },
            {
              selector: '.bgBrown',
              style: {
                'background-color': brown[200],
              },
            },
            {
              selector: '.bgRed',
              style: {
                'background-color': red[200],
              },
            },
            {
              selector: '.bgOrange',
              style: {
                'background-color': orange[200],
              },
            },
            {
              selector: '.bgYellow',
              style: {
                'background-color': yellow[200],
              },
            },
            {
              selector: '.bgLightGreen',
              style: {
                'background-color': lightGreen[200],
              },
            },
            {
              selector: '.bgGreen',
              style: {
                'background-color': green[200],
              },
            },
            {
              selector: '.bgLightBlue',
              style: {
                'background-color': lightBlue[200],
              },
            },
            {
              selector: '.bgBlue',
              style: {
                'background-color': blue[200],
              },
            },
            {
              selector: '.bgDeepPurple',
              style: {
                'background-color': deepPurple[200],
              },
            },
            {
              selector: '.bgPurple',
              style: {
                'background-color': purple[200],
              },
            },
          ]}
        />
      </div>
    );
  }
}

VisualizationPanelVocabularyTab.propTypes = {
  editingVocabulary: PropTypes.object,
  classes: PropTypes.object,
  selectFile: PropTypes.func,
};