// ---------------------------
// Modelo de Nodos y Motor de Query
// ---------------------------

class NodeInstance {
	constructor(id, nodeTypes = [], primitiveValue = null) {
	  this.id = id;
	  this.nodeTypes = Array.isArray(nodeTypes) ? nodeTypes : [nodeTypes];
	  this.primitiveValue = primitiveValue;
	  this.links = {};
	  this.source = null;
	}
  
	addLink(typeKey, node) {
	  if (!this.links[typeKey]) this.links[typeKey] = [];
	  if (!this.links[typeKey].includes(node)) {
		this.links[typeKey].push(node);
		// Bidireccionalidad automática
		if (!node.links) node.links = {};
		if (!node.links[this.nodeTypes[0]]) node.links[this.nodeTypes[0]] = [];
		if (!node.links[this.nodeTypes[0]].includes(this)) {
		  node.links[this.nodeTypes[0]].push(this);
		}
	  }
	}
  
	getLinks(typeKey) {
	  return this.links[typeKey] || [];
	}
  
	// Elimina un link específico en ambas direcciones
	remLink(typeKey, node) {
	  if (this.links[typeKey]) {
		this.links[typeKey] = this.links[typeKey].filter(n => n !== node);
		// Si queda vacío, eliminar la key
		if (this.links[typeKey].length === 0) {
		  delete this.links[typeKey];
		}
	  }
	  // Bidireccionalidad: eliminar referencia en el otro nodo
	  for (const tKey of node.nodeTypes) {
		if (node.links[tKey]) {
		  node.links[tKey] = node.links[tKey].filter(n => n !== this);
		  if (node.links[tKey].length === 0) {
			delete node.links[tKey];
		  }
		}
	  }
	}
  
	// Elimina todos los links de un tipo
	remAllLinks(typeKey) {
	  if (!this.links[typeKey]) return;
	  for (const node of this.links[typeKey]) {
		for (const tKey of node.nodeTypes) {
		  if (node.links[tKey]) {
			node.links[tKey] = node.links[tKey].filter(n => n !== this);
			if (node.links[tKey].length === 0) {
			  delete node.links[tKey];
			}
		  }
		}
	  }
	  delete this.links[typeKey];
	}
  
	cloneAsProjection() {
	  const clone = new NodeInstance(this.id, [...this.nodeTypes], this.primitiveValue);
	  clone.source = this;
	  return clone;
	}
  }
  
  class NodeBase {
	constructor() {
	  this.nodes = {};
	  this.idIndex = {};
	  // Instancia interna de QueryEngine, para getMap
	  this._queryEngine = null;
	}
  
	addNode(node) {
	  for (const typeKey of node.nodeTypes) {
		if (!this.nodes[typeKey]) this.nodes[typeKey] = [];
		if (!this.nodes[typeKey].includes(node)) {
		  this.nodes[typeKey].push(node);
		}
	  }
	  this.idIndex[node.id] = node;
	}
  
	getNodes(typeKey) {
	  return this.nodes[typeKey] || [];
	}
  
	findNodeById(id) {
	  return this.idIndex[id] || null;
	}
  
	// Elimina un nodo y todos los enlaces hacia/desde él
	remNode(node) {
	  // 1. Remover de todas las colecciones por tipo
	  for (const typeKey of node.nodeTypes) {
		if (this.nodes[typeKey]) {
		  this.nodes[typeKey] = this.nodes[typeKey].filter(n => n !== node);
		  if (this.nodes[typeKey].length === 0) {
			delete this.nodes[typeKey];
		  }
		}
	  }
	  // 2. Remover links hacia y desde el nodo
	  for (const key in node.links) {
		for (const linked of node.links[key]) {
		  for (const tKey of linked.nodeTypes) {
			if (linked.links[tKey]) {
			  linked.links[tKey] = linked.links[tKey].filter(n => n !== node);
			  if (linked.links[tKey].length === 0) {
				delete linked.links[tKey];
			  }
			}
		  }
		}
	  }
	  // 3. Limpiar links del propio nodo
	  node.links = {};
	  // 4. Eliminar del índice por ID
	  delete this.idIndex[node.id];
	}
  
	// Ejecuta un query y devuelve los resultados (proyecciones)
	getMap(NodeQuery) {
	  if (!this._queryEngine) {
		this._queryEngine = new QueryEngine(this);
	  }
	  return this._queryEngine.runQuery(NodeQuery);
	}
  }
  
  class QueryEngine {
	constructor(nodeBase) {
	  this.nodeBase = nodeBase;
	}
  
	runQuery(query) {
	  if (!query || !query.length) return [];
	  const contextType = query[0];
	  const paths = query.slice(1);
  
	  const results = [];
	  for (const originalNode of this.nodeBase.getNodes(contextType)) {
		const projNode = this._cloneProjection(originalNode);
		for (const path of paths) {
		  this._resolvePath(projNode, originalNode, path);
		}
		results.push(projNode);
	  }
	  return results;
	}
  
	_cloneProjection(original) {
	  const proj = new NodeInstance(original.id, [...original.nodeTypes], original.primitiveValue);
	  proj.source = original;
	  return proj;
	}
  
	_resolvePath(projNode, origNode, path) {
	  if (typeof path === "string") {
		for (const linked of origNode.getLinks(path)) {
		  const subProj = this._cloneProjection(linked);
		  projNode.addLink(path, subProj);
		}
	  } else if (Array.isArray(path)) {
		this._resolvePathRecursive(projNode, origNode, path, 0);
	  }
	}
  
	_resolvePathRecursive(projNode, origNode, pathArr, index) {
	  if (index >= pathArr.length) return;
	  const currentKey = pathArr[index];
	  for (const linked of origNode.getLinks(currentKey)) {
		const subProj = this._cloneProjection(linked);
		projNode.addLink(currentKey, subProj);
		this._resolvePathRecursive(subProj, linked, pathArr, index + 1);
	  }
	}
  }
  
  // ---------------------------
  // Carga Masiva
  // ---------------------------
  
  async function bulkLoad(nodeArray) {
	const nodeBase = new NodeBase();
	const pendingLinks = [];
	for (const item of nodeArray) {
	  const node = new NodeInstance(item.id, item.nodeTypes, item.primitiveValue || null);
	  nodeBase.addNode(node);
	  pendingLinks.push({ node, rawLinks: item.links || {} });
	}
	for (const { node, rawLinks } of pendingLinks) {
	  for (const [typeKey, idArray] of Object.entries(rawLinks)) {
		for (const targetId of idArray) {
		  const targetNode = nodeBase.findNodeById(targetId);
		  if (targetNode) {
			node.addLink(typeKey, targetNode);
		  } else {
			console.warn(`Link roto: ${node.id} -> (${typeKey}) -> ${targetId}`);
		  }
		}
	  }
	}
	return nodeBase;
  }
  
  // ---------------------------
  // Helper de impresión
  // ---------------------------
  
  function printProjection(node, level = 0) {
	const indent = "  ".repeat(level);
	console.log(`${indent}- id: ${node.id}, type: [${node.nodeTypes.join(", ")}], value: ${node.primitiveValue || ""}, source: ${node.source ? node.source.id : null}`);
	for (const [key, subNodes] of Object.entries(node.links)) {
	  console.log(`${indent}  Link: ${key}`);
	  for (const child of subNodes) {
		printProjection(child, level + 2);
	  }
	}
  }
  
  // ---------------------------
  // EJEMPLO DE USO
  // ---------------------------
  
  const bulkData = [
	{ id: "C1", nodeTypes: ["Contact"], links: { PersonName: ["N1"], PersonLastname: ["N2"], Academy: ["A1"] } },
	{ id: "C2", nodeTypes: ["Contact"], links: { PersonName: ["N3"], PersonLastname: ["N4"], Academy: ["A2"] } },
	{ id: "N1", nodeTypes: ["PersonName"], primitiveValue: "Federico", links: {} },
	{ id: "N2", nodeTypes: ["PersonLastname"], primitiveValue: "García", links: {} },
	{ id: "N3", nodeTypes: ["PersonName"], primitiveValue: "María", links: {} },
	{ id: "N4", nodeTypes: ["PersonLastname"], primitiveValue: "López", links: {} },
	{ id: "A1", nodeTypes: ["Academy"], links: { WebSiteURL: ["U1"], Director: ["D1"] } },
	{ id: "A2", nodeTypes: ["Academy"], links: { WebSiteURL: ["U2"], Director: ["D2"] } },
	{ id: "U1", nodeTypes: ["WebSiteURL"], primitiveValue: "https://uba.ar", links: {} },
	{ id: "U2", nodeTypes: ["WebSiteURL"], primitiveValue: "https://utn.edu.ar", links: {} },
	{ id: "D1", nodeTypes: ["Director"], links: { PersonName: ["N5"] } },
	{ id: "D2", nodeTypes: ["Director"], links: { PersonName: ["N6"] } },
	{ id: "N5", nodeTypes: ["PersonName"], primitiveValue: "Jorge", links: {} },
	{ id: "N6", nodeTypes: ["PersonName"], primitiveValue: "Ana", links: {} },
  ];
  
  async function main() {
	const db = await bulkLoad(bulkData);
  
	// DEMO de remNode y remLink
	// Eliminar el nodo D2 (Director de A2)
	const d2 = db.findNodeById("D2");
	db.remNode(d2);
  
	// Eliminar el link entre C1 y A1 (Academy)
	const c1 = db.findNodeById("C1");
	const a1 = db.findNodeById("A1");
	c1.remLink("Academy", a1);
  
	// Query desde NodeBase usando getMap
	const query = [ "Contact", "PersonName", "PersonLastname", ["Academy", "WebSiteURL", "Director", "PersonName"] ];
	const result = db.getMap(query);
  
	console.log("\n--- Resultado del Query Extenso ---");
	for (const node of result) {
	  printProjection(node);
	}
  }
  
  main();
  
  export { NodeInstance, NodeBase, QueryEngine, bulkLoad, printProjection };
  