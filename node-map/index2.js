// Symbols
const PRIMITIVE_TYPE_STRING = "string";
const PRIMITIVE_TYPE_NUMBER = "number";
const PRIMITIVE_TYPE_BOOLEAN = "boolean";

// --- NodeLink ---
class NodeLink {
	constructor(nodeInstance) {
		this.nodeInstance = nodeInstance;
		// Podrías agregar relationType, metadata, etc, según necesites
	}
}

// --- NodeCollection ---
class NodeCollection {
	constructor() {
		this.content = [];
	}

	add(link) {
		this.content.push(link);
	}

	remove(link) {
		const idx = this.content.indexOf(link);
		if (idx !== -1) this.content.splice(idx, 1);
	}

	findByInstance(nodeInstance) {
		return this.content.find(l => l.nodeInstance === nodeInstance);
	}
}

// --- NodeLinksIndex ---
class NodeLinksIndex {

	constructor() {
		this.index = {}; // { [NodeTypeKey]: NodeCollection }
	}

	getCollection(typeKey) {
		if (!this.index[typeKey]) this.index[typeKey] = new NodeCollection();
		return this.index[typeKey];
	}

}

// --- NodeInstance ---
class NodeInstance {
	constructor(id) {
		this.id = id;
		this.nodeTypes = []; // Array de NodeTypeKeys
		this.primitiveValue = null;
		this.linksIndex = new NodeLinksIndex();
	}

	__addLinkInstance(nodeLink, nodeTypeKey) {
		this.linksIndex.getCollection(nodeTypeKey).add(nodeLink);
	}

	__remLinkInstance(nodeLink, nodeTypeKey) {
		this.linksIndex.getCollection(nodeTypeKey).remove(nodeLink);
	}

	getLinks(nodeTypeKey) {
		return this.linksIndex.index[nodeTypeKey] || null;
	}

	setPrimitiveValue(value) {
		this.primitiveValue = value;
	}

	getPrimitiveValue() {
		return this.primitiveValue;
	}

	getRelatedInstancesByType(nodeTypeKey) {
		const collection = this.getLinks(nodeTypeKey);
		if (!collection) return [];
		return collection.content.map(link => link.nodeInstance);
	}

	hasLinkTo(targetInstance, nodeTypeKey) {
		const collection = this.getLinks(nodeTypeKey);
		if (!collection) return false;
		return collection.content.some(link => link.nodeInstance === targetInstance);
	}
}

// --- NodeItem ---
class NodeItem {
	constructor(instance) {
		this.instance = instance;
		this.childs = [];
	}
}

// --- NodeMap ---
class NodeMap {
	constructor() {
		this.NodeRoot = []; // Array de NodeItem
	}

	toNodeMatrix() {
		// Devuelve el resultado como matriz de valores primitivos (simplificado)
		function traverse(item) {
			if (!item.childs.length) return item.instance.getPrimitiveValue();
			return [
				item.instance.getPrimitiveValue(),
				...item.childs.map(traverse)
			];
		}
		return this.NodeRoot.map(traverse);
	}
}

// --- QueryTree ---
class QueryTree {

	constructor(nodeTypeKey) {
		this.nodeTypeKey = nodeTypeKey;
		this.children = [];
	}

	static fromNodeQuery(nodeQuery) {
		const rootKey = nodeQuery[0];
		const root = new QueryTree(rootKey);
		let current = root;
		for (let i = 1; i < nodeQuery.length; i++) {
			const node = new QueryTree(nodeQuery[i]);
			current.children.push(node);
			current = node;
		}
		return root;
	}



}

// --- NodeBase ---
class NodeBase {
	constructor() {
		this.instancesByType = {}; // { [NodeTypeKey]: Set<NodeInstance> }
	}

	addNodeInstance(nodeTypeKey, nodeInstance) {
		if (!this.instancesByType[nodeTypeKey]) {
			this.instancesByType[nodeTypeKey] = new Set();
		}
		this.instancesByType[nodeTypeKey].add(nodeInstance);
		nodeInstance.nodeTypes.push(nodeTypeKey);
	}

	remNodeInstance(nodeTypeKey, nodeInstance) {
		if (this.instancesByType[nodeTypeKey]) {
			this.instancesByType[nodeTypeKey].delete(nodeInstance);
		}
		const idx = nodeInstance.nodeTypes.indexOf(nodeTypeKey);
		if (idx !== -1) nodeInstance.nodeTypes.splice(idx, 1);
	}

	getAllInstancesOfType(nodeTypeKey) {
		return Array.from(this.instancesByType[nodeTypeKey] || []);
	}

	getNodeType(nodeTypeKey) {
		// Podrías devolver aquí una instancia especial de "NodeType"
		return null; // Placeholder (depende del uso)
	}

	getNodeInstance(nodeTypeKey, nodeId) {
		return this.getAllInstancesOfType(nodeTypeKey).find(n => n.id === nodeId) || null;
	}

	addNodeLink(fromInstance, nodeTypeKey, toInstance) {
		const link = new NodeLink(toInstance);
		fromInstance.__addLinkInstance(link, nodeTypeKey);

		// Bidireccionalidad
		const inverseLink = new NodeLink(fromInstance);
		toInstance.__addLinkInstance(inverseLink, nodeTypeKey);
	}

	remNodeLink(fromInstance, nodeTypeKey, toInstance) {
		const collection = fromInstance.getLinks(nodeTypeKey);
		if (collection) {
			const link = collection.findByInstance(toInstance);
			if (link) fromInstance.__remLinkInstance(link, nodeTypeKey);
		}
		// Bidireccionalidad
		const inverseCollection = toInstance.getLinks(nodeTypeKey);
		if (inverseCollection) {
			const inverseLink = inverseCollection.findByInstance(fromInstance);
			if (inverseLink) toInstance.__remLinkInstance(inverseLink, nodeTypeKey);
		}
	}

	getMap(nodeQuery) {
		const queryTree = QueryTree.fromNodeQuery(nodeQuery);
		const rootNodes = this.getAllInstancesOfType(queryTree.nodeTypeKey);

		function buildNodeMapFromTree(instance, tree) {
			const item = new NodeItem(instance);
			for (const childTree of tree.children) {
				const related = instance.getRelatedInstancesByType(childTree.nodeTypeKey);
				for (const rel of related) {
					item.childs.push(buildNodeMapFromTree(rel, childTree));
				}
			}
			return item;
		}

		const nodeMap = new NodeMap();
		for (const root of rootNodes) {
			nodeMap.NodeRoot.push(buildNodeMapFromTree(root, queryTree));
		}
		return nodeMap;
	}
}

export { NodeMap, NodeBase, NodeInstance, NodeLink, NodeCollection, NodeLinksIndex, QueryTree, NodeItem
};