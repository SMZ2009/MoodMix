async function testApi() {
    const fetch = (await import('node-fetch')).default;
    try {
        const response = await fetch('http://localhost:3001/api/comprehensive_analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_input: 'test', current_time: '2026-03-13' })
        });
        console.log('Status:', response.status);
        const data = await response.json();
        console.log('Data:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    }
}

testApi();
