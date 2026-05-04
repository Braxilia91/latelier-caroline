const SALT = 'latelier-caroline-v1:'

export async function hashPin(pin) {
  const encoder = new TextEncoder()
  const data = encoder.encode(SALT + pin)
  const buf  = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function verifyPin(pin, storedHash) {
  return (await hashPin(pin)) === storedHash
}
