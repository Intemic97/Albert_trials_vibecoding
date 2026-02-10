"""Debug: check when the ODE solver diverges."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
exec(open(os.path.join(os.path.dirname(__file__), 'franmit_model.py')).read().split("if __name__")[0])
import numpy as np

receta = {"Q_H2": 0.003, "Q_but": 0.0, "Q_cat": 0.0012, "Q_cocat": 0.006, "Q_et": 3.5, "Q_hx": 5.0, "T": 353, "grado": "M5206", "ratio_h2_et": 0.001}
reactor_config = {"V_reb": 53, "scale_cat": 1}
qins = {'Q_H2o': 0, 'Q_Hxo': 0, 'Q_Po': [0]*8, 'Q_Yo': [0]*8, 'Q_Y1': [0]*8, 'Q_To': [0]*8, 'Q_T1': [0]*8, 'Q_T2': [0]*8}

solver = SolverR()
params = solver.load_params(8, "BCJ")
nvars = 52
u0 = np.ones(nvars) * 1e-5
T = 40 * 3600
t = np.arange(0, T, 100)  # step=100
args = ([params, receta, qins, reactor_config],)
u = odeint_rk4(REACTOR_NODE, u0, t, args=args)

# Find first NaN timestep
for i in range(len(u)):
    if np.any(np.isnan(u[i])) or np.any(np.isinf(u[i])):
        print(f"First NaN/Inf at timestep {i}, t={t[i]}s ({t[i]/3600:.1f}h)")
        print(f"  Previous step max abs: {np.max(np.abs(u[i-1])):.6e}")
        break
else:
    print("No NaN/Inf found!")
    print(f"Last values (t={t[-1]}s): max={np.max(u[-1]):.6e}, min={np.min(u[-1]):.6e}")

# Test with smaller step
print("\n--- Testing with step=10 ---")
t2 = np.arange(0, T, 10)
u2 = odeint_rk4(REACTOR_NODE, u0, t2, args=args)
for i in range(len(u2)):
    if np.any(np.isnan(u2[i])) or np.any(np.isinf(u2[i])):
        print(f"First NaN/Inf at timestep {i}, t={t2[i]}s ({t2[i]/3600:.1f}h)")
        break
else:
    print("No NaN/Inf! Last values: max={:.6e}, min={:.6e}".format(np.max(u2[-1]), np.min(u2[-1])))
    # Check outputs
    raw = process_output_multiple_sites(u2[-1:], "BCJ", receta, qins, params, reactor_config)
    print(f"  Mi={raw.get('Mi',['?'])[-1]:.4f}, Mw={raw.get('Mw',['?'])[-1]:.0f}, rho={raw.get('rho_p_calculated',['?'])[-1]:.4f}")

