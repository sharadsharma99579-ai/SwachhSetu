"""Evaluate labelled predictions supplied in CSV columns expected,predicted."""
import argparse
from collections import Counter
import csv
import sys
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server import CATEGORIES


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('predictions',type=Path)
    args = parser.parse_args()
    counts = Counter()
    with args.predictions.open(encoding='utf-8-sig',newline='') as stream:
        data = csv.DictReader(stream)
        if not {'expected','predicted'}.issubset(data.fieldnames or ()):
            parser.error('CSV must contain expected,predicted.')
        for number,row in enumerate(data,2):
            pair = row['expected'],row['predicted']
            if any(value not in CATEGORIES for value in pair):
                parser.error(f'Unknown category at line {number}.')
            counts[pair] += 1
    total = sum(counts.values())
    if not total:
        parser.error('Provide at least one labelled prediction.')
    print('Accuracy:',f'{sum(counts[x,x] for x in CATEGORIES)/total:.1%}')
    print('Unknown/mixed rate:',f'{sum(counts[x,CATEGORIES[-1]] for x in CATEGORIES)/total:.1%}')
    writer = csv.writer(sys.stdout)
    writer.writerow(['Expected / predicted',*CATEGORIES,'Precision','Recall'])
    for expected in CATEGORIES:
        row = [counts[expected,predicted] for predicted in CATEGORIES]
        predicted_count = sum(counts[actual,expected] for actual in CATEGORIES)
        match = counts[expected,expected]
        writer.writerow([expected,*row,f'{match/predicted_count:.1%}' if predicted_count else 'n/a',
                         f'{match/sum(row):.1%}' if sum(row) else 'n/a'])


if __name__=='__main__':
    main()
