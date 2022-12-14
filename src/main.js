// =================================================
// ==================== IMPORTS ====================
// =================================================
import Item  from "./entities.js";
import services from "./services/services.js"
import { getAllListenedButtons, defineButtonFunction } from "./buttons.js";
import { updateLocalStorageCart, getCartFromLocalStorage } from "./localStorage.js";
import ui from "./ui/ui.js";

// ===============================================
// ==================== CLASS ====================
// ===============================================
class Storage extends Array {
	referenceProduct(IdProduct) {
		return this.find(product => product.id == IdProduct);
	}

	createProduct(product) {
		this.push(new Item(product.id, product.name, product.price, 1, product.desc, product.img));
	}

	moveProductStockFromThisTo(IdProduct, amount, storageToUpdate) {
		let product = this.referenceProduct(IdProduct);

		if(product.checkStock(amount)) {
			product.stock -= amount;


			if(storageToUpdate.referenceProduct(IdProduct) === undefined) {
				storageToUpdate.createProduct(product);
				storageToUpdate.referenceProduct(product.id).stock = amount;
				return
			}
			storageToUpdate.referenceProduct(product.id).stock += amount;
			return
		}
		ui.alertToastify(PHRASE_STOCKUNAVAILABLE, 'white');
	}

	deleteProdWithNoStock() {
		this.forEach(product => {
			if(!product.stock) {
				let index = this.indexOf(product);
				this.splice(index, 1);
			}
		});
	}

	calcTotal() {
		let total = 0;

		this.forEach(product => total += product.calcSubtotal());
		return total;
	}

	clearOut() {
		this.splice(0, this.length)
	}
}

// ===================================================
// ==================== VARIABLES ====================
// ===================================================
const shop = document.getElementById('shop');
const cartContainer = document.getElementById('cartContainer');

const PHRASE_STOCKUNAVAILABLE = 'No hay más stock disponible';
const PHRASE_IMPOSSIBLEREDUCE = 'No puede tener menos de un producto';
const PHRASE_PRODUCTDELETED = 'Producto eliminado';
const PHRASE_PRODUCTADDED = 'Producto agregado';

let databaseStore = [];
let store = new Storage();
let cart = new Storage();

let indexButtonsFunctionsList = {
		addNew: addNewUnitToCart,
		add: addUnitToCart,
		remove: removeUnitFromCart,
		erase: eraseProductFromCart,
		confirm: confirmPurchase,
		reset: resetApp
}

// ===================================================
// ==================== FUNCTIONS ====================
// ===================================================

// ============== BUTTONS FUNCTIONS ============== //
function addNewUnitToCart(IdProduct) {
	const unit = 1;

	store.moveProductStockFromThisTo(IdProduct, unit, cart);
	ui.alertToastify(PHRASE_PRODUCTADDED, 'green');
}

function addUnitToCart(IdProduct) {
    const unit = 1;

	store.moveProductStockFromThisTo(IdProduct, unit, cart);
}

function removeUnitFromCart(IdProduct) {
	let product = cart.referenceProduct(IdProduct);
    const removeUnit = -1;

	if(product){
		if(-product.stock === removeUnit){
			ui.alertToastify(PHRASE_IMPOSSIBLEREDUCE, 'white');
			return
		}
	}

	store.moveProductStockFromThisTo(IdProduct, removeUnit, cart);
}

function eraseProductFromCart(IdProduct) {
	let amount = cart.referenceProduct(IdProduct).stock;

	cart.moveProductStockFromThisTo(IdProduct, amount, store);
	cart.deleteProdWithNoStock();
	ui.alertToastify(PHRASE_PRODUCTDELETED, 'red');
}

function confirmPurchase() {
	ui.showPurchaseAlert(cart)
		.then((result) => {
			if (result.isConfirmed) {
				completePurchase();
			}
		})
}

async function completePurchase() {
	ui.showLoadingAlert('Procesando compra');
	await services.updateDatabaseProductStock(store, cart)
	await services.postPurchase(cart)
	cart.clearOut();
	updateLocalStorageCart(cart);
	ui.closeAlert();
	refreshIndexDOM();
	ui.showCompletedPurchaseAlert();
}

function resetApp() {
	ui.showConfirmResetAppAlert()
		.then(async (result) => {
			if(result.isConfirmed) {
				ui.showLoadingAlert('Reiniciando aplicación');
				await services.restoreDatabaseToDefault();
				cart.clearOut();
				updateLocalStorageCart(cart);
				ui.closeAlert();
				window.location.reload();
			}
		})
}

// ============== BUTTONS ============== //
function disableOrEnableAddNewButton() {
	store.forEach(product => {
		const {id, stock} = product;
		const hasStock = cart.referenceProduct(id)?.stock;
		let button = document.querySelector(`#addNew-btn-${id}`);

		if(!stock || hasStock) {
			ui.changeButtonStyleToDisable(button);
			button.disabled = true;
		} else {
			ui.changeButtonStyleToEnable(button);
			button.disabled = false;
		}
	});
}

function initEventListener(buttonsArray) {
	for(let button of buttonsArray) {
		const buttonFunction = defineButtonFunction(indexButtonsFunctionsList, button);

		button.addEventListener('click', () => {
			const id = button.id.charAt(button.id.length - 1)

			buttonFunction(id)
			updateLocalStorageCart(cart);
			refreshIndexDOM();
		})
	}
}

// ============== LOCALSTORAGE ============== //
function checkLocalStorageAndUpdateCart() {
	const cartLS = getCartFromLocalStorage();

	if(cartLS) {
		cartLS.map(element => {
			store.moveProductStockFromThisTo(element.id, element.stock, cart);
		});
	}
}

function synchronizeStoreWithDatabaseStore() {
	databaseStore.forEach(product => {
		const {id, name, price, stock, desc, img} = product;
		let item = new Item(id,	name, price, stock, desc, img);

		store.push(item);
	});
}

async function updateLocalDatabaseStoreArray() {
	ui.showLoadingAlert('Cargando productos');
    databaseStore = await services.getDatabaseProducts();
	ui.closeAlert();
}

// ============== INIT ============== //
function refreshIndexDOM() {
	shop.innerHTML = '';
	ui.generateShop(store);

	cartContainer.innerHTML = '';
	cart.deleteProdWithNoStock();

	if(cart.calcTotal()) {
		ui.generateCart(cart);
	}
	disableOrEnableAddNewButton();
	initEventListener(getAllListenedButtons());
}

function init() {
	updateLocalDatabaseStoreArray()
		.then(() => {
			synchronizeStoreWithDatabaseStore();
			checkLocalStorageAndUpdateCart();
			refreshIndexDOM();
		})
		.catch(err => console.log(err))
}

init();
