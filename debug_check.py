import sys
data=open(r'd:\Abel paginas\Aquatech\crm mayo\aquatech-render-main\final_test_check.txt','rb').read()
result=f'Size on disk: {len(data)}\n'
marker=b'[data:cache_control;base64,ZXBoZW1lcmFs]'
result+=f'Marker in file? {marker in data}\n'
result+=f'Last 100 bytes: {repr(data[-100:])}\n'
open(r'd:\Abel paginas\Aquatech\crm mayo\aquatech-render-main\debug_result.txt','w').write(result)