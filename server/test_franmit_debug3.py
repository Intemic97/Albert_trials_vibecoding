"""Debug: find the right step size for RK4."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
exec(open(os.path.join(os.path.dirname(__file__), 'franmit_model.py')).read().split("if __name__")[0])
import numpy as np

receta = {"Q_H2": 0.003, "Q_but": 0.0, "Q_cat": 0.0012, "Q_cocat": 0.006, "Q_et": 3.5, "Q_hx": 5.0, "T": 353, "grado": "M5206", "ratio_h2_et": 0.001}
reactor_config = {"V_reb": 53, "scale_cat": 1}
qins = {'Q_H2o': 0, 'Q_Hxo': 0, 'Q_Po': [0]*8, 'Q_Yo': [0]*8, 'Q_Y1': [0]*8, 'Q_To': [0]*8, 'Q_T1': [0]*8, 'Q_T2': [0]*8}

solver = SolverR()
params = solver.load_params(8, "BCJ")
u0 = np.ones(52) * 1e-5
T_total = 40 * 3600

for step in [1, 0.5, 0.1, 0.01]:
    # Only simulate first 100s to test stability
    t_test = np.arange(0, min(200, T_total), step)
    u_test = odeint_rk4(REACTOR_NODE, u0, t_test, args=([params, receta, qins, reactor_config],))
    nan_idx = -1
    for i in range(len(u_test)):
        if np.any(np.isnan(u_test[i])) or np.any(np.isinf(u_test[i])):
            nan_idx = i
            break
    if nan_idx >= 0:
        print(f"step={step:6.3f}s => NaN at t={t_test[nan_idx]:.1f}s (step {nan_idx})")
    else:
        print(f"step={step:6.3f}s => OK! max={np.max(np.abs(u_test[-1])):.4e}")

