// Replace this with the public URL of the Render web service.
window.API_BASE = window.API_BASE || 'https://collection-shoe-center.onrender.com';

window.sendOrderEmail = async function (order) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 90000);
	let response;
	try {
		response = await fetch(`${window.API_BASE}/api/order-request`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(order),
			signal: controller.signal
		});
	} catch (error) {
		if (error.name === 'AbortError') throw new Error('The order service took too long to respond. Please try again.');
		throw new Error('Could not reach the order service. Please try again.');
	} finally {
		clearTimeout(timeout);
	}
	let result = {};
	try { result = await response.json(); } catch (error) { /* The server may return an empty error response. */ }
	if (!response.ok) throw new Error(result.error || 'Could not send the order request.');
	if (result.emailSent === false) {
		throw new Error(`Order received, but the notification email could not be delivered. Reference: ${result.orderId || 'saved order'}.`);
	}
	return result;
};
