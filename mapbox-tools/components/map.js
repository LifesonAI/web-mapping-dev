import Core from '../../basic-tools/tools/core.js'
import Evented from '../../basic-tools/components/evented.js'

export default class Map extends Evented {
				
	/**
	 * Set the map box access token
	 * @param {string} value - map box access token
	 */
	static set Token(value) { 
		mapboxgl.accessToken = value; 
	}
	
	// Get the access token
	static get Token() { 
		return mapboxgl.accessToken; 
	}
	
	// Get the map container
	get Container() {
		return this.map._container;
	}
	
	// Get the center of the map
	// e.g. {lat: 50, lng: -100}
	get Center() {
		return this.map.getCenter();
	}
	
	set Center(value) {
		this.map.setCenter(value)
	}
	
	// Get the current map zoom level (numeric value)
	get Zoom() {
		return this.map.getZoom();
	}
	
	set Zoom(value) {
		this.map.setZoom(value)
	}
	
	// Get the current map style URL
	get Style() {
		return this.style;
	}
	
	constructor(options) {
		super();
		
		this.layers = [];
		this.original = {};
		this.maxExtent = [[-162.0, 41.0], [-32.0, 83.5]];
		this.style = options.style;
		
		this.click = this.OnLayerClick_Handler.bind(this);;
		
		this.map = new mapboxgl.Map(options); 
		
		// Set the maximum bounds of the map
		this.SetMaxBounds(this.maxExtent);

		this.map.once('styledata', this.OnceStyleData_Handler.bind(this));
		
		// this.map.on('click', this.click);
		
		this.WrapEvent('moveend', 'MoveEnd');
		this.WrapEvent('zoomend', 'ZoomEnd');
		this.WrapEvent('load', 'Load');
		
		this.map.once('load', ev => {
			// Fix for improve this map in french
			this.map.getContainer().querySelector('.mapbox-improve-map').innerHTML = Core.Nls("Mapbox_Improve");
		})
	}
	
	AddSource(name, data) {
		this.map.addSource('odhf', data);
	}

	/**
	 * Add a specified map control to the map.
	 * @param {object} control - map control object
	 * @param {string} location - location of the object. e.g. 'top-left'
	 */
	AddControl(control, location) {
		this.map.addControl(control, location);
	}
	
	InfoPopup(lngLat, html) {	
		var popup = new mapboxgl.Popup({ closeOnClick: true })
			.setLngLat(lngLat)
			.setHTML(html)
			.addTo(this.map);
					
		popup._closeButton.innerHTML = '<i class="fa fa-times" aria-hidden="true"></i>';
		popup._closeButton.setAttribute('aria-label', Core.Nls('Mapbox_Close_Popup'));
		popup._closeButton.title = Core.Nls('Mapbox_Close_Popup');
	}
	
	Reset(layers) {
		layers.forEach(l => {
			this.map.setPaintProperty(l, 'fill-color', this.original[l])
		});
		
		this.original = {};
	}
	
	/**
	 * Retrieves the layer type 
	 * @param {string} layerId - id of the map layer
	 */
	GetLayerType(layerId) {
		const layer = this.map.getLayer(layerId);
		let layerType;

		if (layer.type) {
			layerType = layer.type;
		}

		return layerType;
	}

	/**
	 * Get the layer color paint property name based on layer type
	 * @param {string} layerType - The layer type 
	 */
	GetLayerColorPropertyByType(layerType) {
		let layerPaintProperty;

		switch (layerType) {
			case 'circle':
				layerPaintProperty = 'circle-color';
				break;
			case 'line':
				layerPaintProperty = 'line-color';
				break;
			case 'fill':
				layerPaintProperty = 'fill-color';
				break;
			case 'symbol':
				layerPaintProperty = 'icon-color';
				break;
			case 'background':
				layerPaintProperty = 'background-color';
				break;
			case 'heatmap':
				layerPaintProperty = 'heatmap-color';
				break;
			case 'fill-extrusion':
				layerPaintProperty = 'fill-extrusion-color';
				break;
			default:
				layerPaintProperty = 'circle-color';
		}		

		return layerPaintProperty;
	}

	/**
	 * Method to update a style property for a layer
	 * @param {string} layerId - Name of the map layer
	 * @param {string} paintProperty - Paint Property of the map layer
	 * @param {array || string} styleRules - Mapbox expression of style rules or a rgba string value.
	 */
	SetPaintProperty(layerId, paintProperty, styleRules) {
		// Check that layer exists in map
		if (this.map.getLayer(layerId)) {
			this.map.setPaintProperty(layerId, paintProperty, styleRules);
		}
	}

	/**
	 * Gets the style data from provided legend item
	 * @param {object} legendItem - Object containing the style information 
	 * @retruns - An object containing the legendItem color and value if available
	 */
	GetStylingFromLegendItem(legendItem) {
		let style = {};

		if (legendItem.color) {
			style.color = legendItem.color;

			if (legendItem.value) {
				style.value = legendItem.value;
			}
		}

		return style;
	}

	/**
	 * Gets a list of style colours and values defined in the map config legend.
	 * @param {array} legendItems - List of legend items containing style rules
	 * @returns - A list of style objects containing colours and conditions
	 * needed to paint layers with that colour.
	 */
	GetListOfStyles(legendItems) {
		let i, legendItem;
		let styleCollection = [];

		// Iterate through legendItems and get styling from each
		if (Array.isArray(legendItems)) {
			for (i = 0; i < legendItems.length; i += 1) {
				legendItem = legendItems[i];
				styleCollection.push(this.GetStylingFromLegendItem(legendItem));
			}
		}

		return styleCollection;
	}	

	/**
	 * Generate all style classes defined in the map config file.
	 * @param {object} styles - object containing the legend details stored in
	 * the map config file.
	 * @param {array} opacities - list of opacity values
	 * @retruns - A list of colour classes using style data and opacity values.
	 */
	GenerateColourClasses(styles, opacities) {
		var updatedColor, i, styleItem, defaultColour;
		var styleOpacities = opacities || 1;
		var classes = ['case'];
		var legendStyles = this.GetListOfStyles(styles);
		
		// Check that legend items length equals opacity length
		if (legendStyles.length) {
			for (i = 0; i < legendStyles.length; i += 1) {
				styleItem = legendStyles[i];

				// Get color for style 
				if (Array.isArray(styleOpacities) && styleOpacities.length) {
					updatedColor = styleItem.color.length == 3 ? `rgba(${styleItem.color.join(',')},${styleOpacities[i]})` : `rgba(${styleItem.color.join(',')})`;
				} else {
					updatedColor = styleItem.color.length == 3 ? `rgba(${styleItem.color.join(',')},${styleOpacities})` : `rgba(${styleItem.color.join(',')})`;
				}

				if (styleItem.value && updatedColor) {
					// Add mapbox expression value is defined, add it to classes list
					classes.push(styleItem.value);						

					// Add colour to classes list
					classes.push(updatedColor);
				} else {
					defaultColour = updatedColor;
				}
			}

			// Add default colour as last item in colour classes
			// This is required by mapbox to in sure errors 
			// don't occur when the last item in the legend config
			// is not the default colour (i.e. the one without a 
			// a defined mapbox expression value)
			classes.push(defaultColour);
		}

		return classes;
	}

	/*This is used with an array of colors and (single opacity or array of opacity values)*/
	Choropleth(layers, property, legend, opacity) {
		var classes = this.GenerateColourClasses(legend, opacity);
		layers.forEach(l => {
			this.original[l] = this.map.getPaintProperty(l, property);
			this.SetPaintProperty(l, property, classes);
		});
	}

	/*This is used with a single color value and an array of opacity values)*/
	ChoroplethVarOpac(layers, property, legend, opacity) {
		let color, i, defaultColour, updatedColor;
		var classes = this.GenerateColourClasses(legend, opacity);

		// Over-ride classes if the property is 'text-halo-color, text-color,
		// or a circle-stroke-color
		if (property === 'text-halo-color') {
			color = [255,255,255];
		} else if (property === 'text-color' || property === 'circle-stroke-color') {
			color = [0,0,0];
		}

		// If an over-ride colour exists, than regenerate style classes
		if (color) {
			classes = ['case'];

			legend.forEach(function(l, index) {			
			
				updatedColor = `rgba(${color.join(',')},${opacity[index]})`;
			
				if (l.value) {
					classes.push(l.value);
		
					classes.push(updatedColor);
				} else {
					defaultColour = updatedColor;
				}

			});

			// Make sure catch-all/default color is at end of mapbox expression
			// represnting the colour classes.
			classes.push(defaultColour);
		}

		layers.forEach(l => {
			this.original[l] = this.map.getPaintProperty(l, property);
			this.SetPaintProperty(l, property, classes);
		});
	}

	ReorderLayers(layers) {
		layers.forEach(l => this.map.moveLayer(l));
	}
	
	GetLayer(layer) {
		return this.map.getLayer(layer) || null;
	}
	
	ShowLayer(layer) {
		this.map.setLayoutProperty(layer, 'visibility', 'visible');
	}
	
	HideLayer(layer) {
		this.map.setLayoutProperty(layer, 'visibility', 'none');
	}
	
	HideLayers(layers) {
		layers.forEach(l => this.HideLayer(l));
	}
	
	ShowLayers(layers) {
		layers.forEach(l => this.ShowLayer(l));
	}
	
	/**
	 * Set the map bounds for the map.
	 * @param {array} bounds - An array containing coordinate pairs for the map bounds.
	 * @param {object} options - object containing options when fitting the map bounds 
	 */
	FitBounds(bounds, options) {		
		this.map.fitBounds(bounds, options);
	}

	/**
	 * Set the maximum bounds of the map
	 * @param {array} bounds - An array containing coordinate pairs for the map bounds.
	 * e.g. [[x1, y1], [x2, y2]]
	 */
	SetMaxBounds(bounds) {
		this.map.setMaxBounds(bounds);
	}

	SetStyle(style) {
		this.style = style;
		
		this.map.once('styledata', this.OnceStyleData_Handler.bind(this))
		
		this.map.setStyle(style);
	}
	
	SetClickableMap(layers) {				
		this.map.on('click', this.click);
	}
	
	SetClickableLayers(layers) {
		layers.forEach(l => this.map.off('click', l, this.click)); 
		
		this.layers = layers;
		
		this.layers.forEach(l => this.map.on('click', l, this.click));
	}
	
	QueryRenderedFeatures(point, layers) {
		return this.map.queryRenderedFeatures(point, { layers: layers });
	}
	
	OnceStyleData_Handler(ev) {
		this.Emit('StyleChanged', ev);
	}
	
	/**
	 * Event handler for clicking on the map, and emits a 'Click' event.
	 * @param {object} ev - click event object
	 */
	OnLayerClick_Handler(ev) {
		this.Emit('Click', ev);
	}
	
	WrapEvent(oEv, nEv) {
		var f = (ev) => this.Emit(nEv, ev);
		
		this.map.on(oEv, f);
	}
}
