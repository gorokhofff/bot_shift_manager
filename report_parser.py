import re

def parse_report(text):
    data = {}

    # Пытаемся извлечь продажи
    sales_match = re.search(r'satış-(.*?)\n', text)
    if sales_match:
        data['sales'] = sales_match.group(1).strip()

    # Пытаемся извлечь бесплатные
    free_match = re.search(r'Ücretsiz-(.*?)Değiştirme-', text, re.DOTALL)
    if free_match:
        data['free'] = free_match.group(1).strip()

    return data
