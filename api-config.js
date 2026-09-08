// Replace this with the public URL of the Render web service.
window.API_BASE = window.API_BASE || 'https://collection-shoe-center.onrender.com';

window.sendOrderEmail = async function (order) {
	const response = await fetch(`${window.API_BASE}/api/order-request`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(order)
	});
	let result = {};
	try { result = await response.json(); } catch (error) { /* The server may return an empty error response. */ }
	if (!response.ok) throw new Error(result.error || 'Could not send the order request.');
	return result;
};
