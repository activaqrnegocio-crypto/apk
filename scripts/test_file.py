import os
path = r'd:\Abel paginas\Aquatech\crm mayo\aquatech-render-main\test_agent.txt'
content = 'Test from agent: 1234567890 abcdefghijklmnopqrstuvwxyz'
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
with open(path, 'rb') as f:
    data = f.read()
print('File exists:', os.path.exists(path))
print('Content:', data.decode('utf-8'))
print('Length:', len(data))
print('Hex:', data.hex())
print('Last 10 bytes hex:', data[-10:].hex())