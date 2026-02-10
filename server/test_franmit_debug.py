"""Quick debug: check raw outputs from the model."""
import sys, json, os
sys.path.insert(0, os.path.dirname(__file__))

# Import everything from franmit_model
exec(open(os.path.join(os.path.dirname(__file__), 'franmit_model.py')).read().split("if __name__")[0])

import numpy as np

receta = {"Q_H2": 0.003, "Q_but": 0.0, "Q_cat": 0.0012, "Q_cocat": 0.006, "Q_et": 3.5, "Q_hx": 5.0, "T": 353, "grado": "M5206", "ratio_h2_et": 0.001}
reactor_config = {"V_reb": 53, "scale_cat": 1}
qins = {'Q_H2o': 0, 'Q_Hxo': 0, 'Q_Po': [0]*8, 'Q_Yo': [0]*8, 'Q_Y1': [0]*8, 'Q_To': [0]*8, 'Q_T1': [0]*8, 'Q_T2': [0]*8}

grado = "M5206"
recetas_dict = {grado: receta}

u, outs_dict, qouts = solve_recetas_parallel(qins, recetas_dict, reactor_config)
raw = outs_dict[grado]

# Check which keys have valid (non-NaN) last values
for key in sorted(raw.keys()):
    val = raw[key]
    if hasattr(val, '__len__') and len(val) > 0:
        last = val[-1] if not hasattr(val[-1], '__len__') else val[-1][-1] if hasattr(val[-1], '__len__') and len(val[-1]) > 0 else 'array'
        is_nan = False
        try:
            is_nan = np.isnan(last) or np.isinf(last)
        except:
            pass
        print(f"  {key:25s} len={len(val):5d}  last={last}  nan={is_nan}")
    else:
        print(f"  {key:25s} scalar={val}")

